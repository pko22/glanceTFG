import JSZip from 'jszip';
import Vue from 'vue';
import Vuex from 'vuex';

import vtk from '@kitware/vtk.js/vtk';
import vtkProxyManager from '@kitware/vtk.js/Proxy/Core/ProxyManager';

import { ProxyManagerVuexPlugin } from 'paraview-glance/src/plugins/proxyManagerPlugins';

import viewHelper from 'paraview-glance/src/components/core/VtkView/helper';
import ReaderFactory from 'paraview-glance/src/io/ReaderFactory';
import postProcessDataset from 'paraview-glance/src/io/postProcessing';
import Config from 'paraview-glance/src/config';
import files, { getExtension } from 'paraview-glance/src/store/fileLoader';
import views from 'paraview-glance/src/store/views';
import widgets from 'paraview-glance/src/store/widgets';
import animations from 'paraview-glance/src/store/animations';
import api from 'paraview-glance/src/api/api';

import {
  wrapMutationAsAction,
  createRepresentationInAllViews,
} from 'paraview-glance/src/utils';

import auth from 'paraview-glance/src/store/auth';

const STATE_VERSION = 2;

// http://jsperf.com/typeofvar
function typeOf(o) {
  return {}.toString.call(o).slice(8, -1).toLowerCase();
}

function extractFilenameFromUrl(url) {
  return url.split('/').pop()?.split('?').shift();
}

/* eslint-disable no-param-reassign */
function merge(dst, src) {
  const keys = Object.keys(src);
  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i];
    if (typeOf(dst[key]) === 'object' && typeOf(src[key]) === 'object') {
      Vue.set(dst, key, merge(dst[key], src[key]));
    } else {
      Vue.set(dst, key, src[key]);
    }
  }
  return dst;
}

function stepActiveSlice(proxyManager, inc) {
  const view = proxyManager.getActiveView();
  const source = proxyManager.getActiveSource();
  const r = proxyManager.getRepresentation(source, view);
  const domain = r.getPropertyDomainByName('slice');
  if (r.isA('vtkSliceRepresentationProxy') && domain) {
    const step = inc ? domain.step : -domain.step;
    const slice = Math.min(
      domain.max,
      Math.max(domain.min, r.getSlice() + step)
    );
    r.setSlice(slice);
  }
}

function createStore(injected) {
  const { girder } = injected;

  let { proxyManager } = injected;
  if (!proxyManager) {
    proxyManager = vtkProxyManager.newInstance({
      proxyConfiguration: Config.Proxy,
    });
  }
  const animationManager = proxyManager.createProxy(
    'AnimationManager',
    'AnimationProxyManager'
  );

  const $store = new Vuex.Store({
    plugins: [ProxyManagerVuexPlugin(proxyManager)],
    state: {
      proxyManager,
      route: 'landing',
      currentStateId: null, // Para saber el id con el que hacer defacing
      savingStateName: null,
      loadingState: false,
      screenshotDialog: false,
      pendingScreenshot: null,
      panels: {},
      cameraViewPoints: {},
      mostRecentViewPoint: null,
      collapseDatasetPanels: false,
      suppressBrowserWarning: false,
      originalFiles: [], // Almacén de dicoms originales para defacing
    },
    getters: {
      proxyManager(state) {
        return state.proxyManager;
      },
      cameraViewPoints(state) {
        return state.cameraViewPoints;
      },
      mostRecentViewPoint(state) {
        return state.mostRecentViewPoint;
      },
    },
    modules: {
      files: files({ proxyManager, girder }),
      views: views({ proxyManager, girder }),
      widgets: widgets({ proxyManager, girder }),
      animations: animations({ animationManager }),
      auth,
    },
    mutations: {
      // CORRECCIÓN LINTER: Cambiado 'files' por 'rawFiles'
      SET_ORIGINAL_FILES(state, rawFiles) {
        state.originalFiles = rawFiles;
      },
      SET_CURRENT_STATE_ID(state, id) {
        state.currentStateId = id;
        console.log('Store: ID del archivo actualizado a:', id);
      },
      showLanding(state) {
        state.route = 'landing';
      },
      showApp(state) {
        state.route = 'app';
      },
      savingState(state, name = null) {
        state.savingStateName = name;
      },
      loadingState(state, flag) {
        state.loadingState = flag;
      },
      addPanel: (state, { component, priority = 0 }) => {
        if (!(priority in state.panels)) {
          Vue.set(state.panels, priority, []);
        }
        state.panels[priority].push(component);
      },
      openScreenshotDialog(state, screenshot) {
        state.pendingScreenshot = screenshot;
        state.screenshotDialog = true;
      },
      closeScreenshotDialog(state) {
        state.pendingScreenshot = null;
        state.screenshotDialog = false;
      },
      mostRecentViewPoint(state, viewPoint) {
        state.mostRecentViewPoint = viewPoint;
      },
      collapseDatasetPanels(state, value) {
        state.collapseDatasetPanels = value;
      },
      suppressBrowserWarning(state, value) {
        state.suppressBrowserWarning = value;
      },
    },
    actions: {
      addPanel: wrapMutationAsAction('addPanel'),
      closeScreenshotDialog: wrapMutationAsAction('closeScreenshotDialog'),
      collapseDatasetPanels: wrapMutationAsAction('collapseDatasetPanels'),
      suppressBrowserWarning: wrapMutationAsAction('suppressBrowserWarning'),

      // CORRECCIÓN LINTER: Cambiado de 'files' a 'filesToSave'
      saveOriginalFilesForDefacing({ commit }, filesToSave) {
        console.log('--- SECUESTRANDO ARCHIVOS PARA EL TFG ---');
        console.log(`Guardando ${filesToSave.length} archivos en el almacén.`);
        commit('SET_ORIGINAL_FILES', filesToSave);
      },

      saveState({ commit, state }, fileNameToUse) {
        const t = new Date();
        const fileName =
          fileNameToUse ||
          `${t.getFullYear()}${
            t.getMonth() + 1
          }${t.getDate()}_${t.getHours()}-${t.getMinutes()}-${t.getSeconds()}.glance`;

        commit('savingState', fileName);

        const activeSourceId = proxyManager.getActiveSource()
          ? proxyManager.getActiveSource().getProxyId()
          : -1;

        const userData = {
          version: STATE_VERSION,
          activeSourceId,
          store: {
            route: state.route,
            views: state.views,
            widgets: state.widgets,
          },
        };

        const options = {
          recycleViews: true,
          datasetHandler(dataset, source) {
            const sourceMeta = source.get('name', 'url', 'remoteMetaData');
            const datasetMeta = dataset.get('name', 'url', 'remoteMetaData');
            const metadata = sourceMeta.url ? sourceMeta : datasetMeta;
            if (source.getKey('girderProvenance')) {
              return {
                serializedType: 'girder',
                provenance: source.getKey('girderProvenance'),
                item: source.getKey('girderItem'),
                meta: source.getKey('meta'),
              };
            }
            if (metadata.name && metadata.url) {
              return metadata;
            }
            return dataset.getState();
          },
        };

        const zip = new JSZip();
        proxyManager.saveState(options, userData).then((stateObject) => {
          zip.file('state.json', JSON.stringify(stateObject));
          zip
            .generateAsync({
              type: 'blob',
              compression: 'DEFLATE',
              compressionOptions: {
                level: 6,
              },
            })
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.setAttribute('href', url);
              anchor.setAttribute('download', fileName);
              document.body.appendChild(anchor);
              anchor.click();
              document.body.removeChild(anchor);
              setTimeout(() => URL.revokeObjectURL(url), 60000);
            })
            .then(() => commit('savingState', null));
        });
      },

      postState({ commit, state }, payload = {}) {
        return new Promise((resolve, reject) => {
          const t = new Date();
          const fileName = `${t.getFullYear()}${
            t.getMonth() + 1
          }${t.getDate()}_${t.getHours()}-${t.getMinutes()}-${t.getSeconds()}.glance`;

          console.log('Iniciando empaquetado del archivo:', fileName);
          commit('savingState', fileName);

          const activeSourceId = proxyManager.getActiveSource()
            ? proxyManager.getActiveSource().getProxyId()
            : -1;

          const userData = {
            version: STATE_VERSION,
            activeSourceId,
            store: {
              route: state.route,
              views: state.views,
              widgets: state.widgets,
            },
          };

          const options = {
            recycleViews: true,
            datasetHandler(dataset, source) {
              const sourceMeta = source.get('name', 'url', 'remoteMetaData');
              const datasetMeta = dataset.get('name', 'url', 'remoteMetaData');
              const metadata = sourceMeta.url ? sourceMeta : datasetMeta;
              if (metadata.name && metadata.url) {
                return metadata;
              }
              return dataset.getState();
            },
          };

          const zip = new JSZip();

          proxyManager
            .saveState(options, userData)
            .then(async (stateObject) => {
              // 1. Guardamos el JSON de la escena
              zip.file('state.json', JSON.stringify(stateObject));

              const dicomFolder = zip.folder('dicoms');
              let totalFilesAdded = 0;

              // --- LÓGICA DE EXTRACCIÓN PARA EL TFG ---

              // A. Intentar obtener archivos vinculados a las Fuentes (Inyectados por ReaderFactory)
              const sources = proxyManager.getSources();
              sources.forEach((source) => {
                const fileData = source.getKey('files');
                if (fileData && fileData.files) {
                  const filesArray = fileData.files;
                  console.log(
                    `Fuente "${source.getName()}": detectados ${
                      filesArray.length
                    } archivos vinculados.`
                  );
                  filesArray.forEach((file) => {
                    dicomFolder.file(file.name, file);
                    totalFilesAdded += 1;
                  });
                }
              });

              // B. Si lo anterior no encontró nada, recurrir al almacén global originalFiles
              if (totalFilesAdded === 0) {
                console.warn(
                  'No se detectaron archivos en las fuentes. Usando almacén de respaldo...'
                );
                const backupFiles = state.originalFiles || [];
                backupFiles.forEach((file) => {
                  dicomFolder.file(file.name, file);
                  totalFilesAdded += 1;
                });
              }

              console.log(
                `TOTAL archivos empaquetados en el ZIP: ${totalFilesAdded}`
              );

              if (totalFilesAdded === 0) {
                console.error(
                  'ERROR CRÍTICO: No hay archivos DICOM para enviar.'
                );
              }

              // 2. Generar el ZIP y enviar
              zip
                .generateAsync({
                  type: 'blob',
                  compression: 'DEFLATE',
                  compressionOptions: { level: 6 },
                })
                .then(async (blob) => {
                  try {
                    const formData = new FormData();
                    formData.append('file', blob, fileName);

                    // Datos del formulario
                    formData.append('label', payload.label || 'Sin título');
                    formData.append('description', payload.description || '');
                    formData.append(
                      'isPublic',
                      String(payload.isPublic ?? false)
                    );
                    formData.append(
                      'acknowledgement',
                      payload.acknowledgement || ''
                    );
                    formData.append(
                      'defaced',
                      String(payload.defaced ?? false)
                    );

                    // Imagen de previsualización
                    if (payload.imagen) {
                      const imageFile =
                        payload.imagen instanceof File
                          ? payload.imagen
                          : new File([payload.imagen], 'preview.png', {
                              type: payload.imagen.type || 'image/png',
                            });
                      formData.append('imagen', imageFile);
                    }

                    console.log(
                      `Enviando a Java: ${totalFilesAdded} archivos DICOM.:`,
                      formData
                    );

                    const response = await api.post('/files', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                    });

                    if (response.data && response.data.id) {
                      commit('SET_CURRENT_STATE_ID', response.data.id);
                      console.log(
                        'ID guardado exitosamente tras el POST:',
                        response.data.id
                      );
                    } else {
                      console.warn(
                        'La respuesta del servidor no contenía un ID válido:',
                        response.data
                      );
                    }
                    resolve(response.data);
                  } catch (err) {
                    console.error('Error en la petición POST:', err);
                    reject(err);
                  }
                })
                .catch((err) => {
                  console.error('Error generando ZIP:', err);
                  reject(err);
                })
                .finally(() => commit('savingState', null));
            });
        });
      },

      restoreAppState({ commit, dispatch, state }, appState) {
        commit('loadingState', true);
        const restoreProxyKeys = new WeakMap();
        dispatch('resetWorkspace');
        return proxyManager
          .loadState(appState, {
            datasetHandler(ds) {
              if (ds.vtkClass) {
                return vtk(ds);
              }
              let name = ds.name;
              let url = ds.url;
              const options = {};
              if (ds.serializedType === 'girder') {
                const { itemId, itemName } = ds.item;
                const { apiRoot } = ds.provenance;
                name = itemName;
                url = `${apiRoot}/item/${itemId}/download`;
                options.headers = {
                  ...(options.headers || {}),
                  'Girder-Token': girder.girderRest.token,
                };
              }

              let loadDataset;
              if (ds.seriesUrls) {
                const extension = getExtension(ds.name);
                const promises = ds.seriesUrls.map((u) =>
                  ReaderFactory.downloadDataset(
                    extractFilenameFromUrl(u),
                    u,
                    options
                  )
                );
                loadDataset = Promise.all(promises).then((fileSeries) =>
                  ReaderFactory.loadFileSeries(fileSeries, extension, name)
                );
              } else {
                loadDataset = ReaderFactory.downloadDataset(name, url, {
                  ...options,
                  progressCallback(progress) {
                    const percentage = progress.lengthComputable
                      ? progress.loaded / progress.total
                      : Infinity;
                    commit('files/setProgress', { id: name, percentage });
                  },
                })
                  .then((file) => ReaderFactory.loadFiles([file]))
                  .then((readers) => readers[0]);
              }

              return loadDataset
                .then(({ dataset, reader }) => {
                  let outDS = null;
                  if (reader && reader.getOutputData) {
                    outDS = reader.getOutputData();
                  } else if (dataset && dataset.isA) {
                    outDS = dataset;
                  } else if (reader && reader.setProxyManager) {
                    reader.setProxyManager(proxyManager);
                    return null;
                  }
                  if (!outDS) {
                    throw new Error('Invalid dataset');
                  }
                  if (ds.serializedType === 'girder') {
                    outDS = postProcessDataset(outDS, ds.meta);
                    restoreProxyKeys.set(outDS, {
                      girderProvenance: ds.provenance,
                      girderItem: ds.item,
                      meta: ds.meta,
                    });
                  } else {
                    outDS.set(ds, true);
                  }
                  return outDS;
                })
                .catch((e) => {
                  const moreInfo = `Dataset doesn't exist or adblock/firewall prevents access.`;
                  if ('xhr' in e) {
                    const { xhr } = e;
                    throw new Error(
                      `${xhr.statusText} (${xhr.status}): ${moreInfo}`
                    );
                  }
                  throw new Error(`${e.message} (${moreInfo})`);
                });
            },
          })
          .then((userData) => {
            const { version, store, $oldToNewIdMapping } = userData;
            if (version >= 2) {
              this.replaceState(merge(state, store));
            } else {
              this.replaceState(merge(state, userData));
            }

            proxyManager.getSources().forEach((source) => {
              const ds = source.getDataset();
              if (restoreProxyKeys.has(ds)) {
                const kv = restoreProxyKeys.get(ds);
                Object.keys(kv).forEach((key) => source.setKey(key, kv[key]));
              }
            });

            dispatch('rewriteProxyIds', {
              appState,
              mapping: $oldToNewIdMapping,
            }).then(() => {
              proxyManager.modified();
              const visibleViews = proxyManager
                .getViews()
                .filter((view) => view.getContainer());
              const view3D = visibleViews.find(
                (view) => view.getProxyName() === 'View3D'
              );
              const viewToActivate = view3D || visibleViews[0];
              if (viewToActivate) {
                viewToActivate.activate();
              }
              proxyManager
                .getSources()
                .forEach((s) =>
                  createRepresentationInAllViews(proxyManager, s)
                );

              if (version >= 2) {
                const { activeSourceId } = userData;
                const id = $oldToNewIdMapping[activeSourceId];
                const source = proxyManager.getProxyById(id);
                if (source) {
                  source.activate();
                }
              } else {
                const source = proxyManager.getSources()[0];
                if (source) {
                  source.activate();
                }
              }
            });
          })
          .then(() => commit('loadingState', false));
      },
      resetWorkspace() {
        proxyManager
          .getSources()
          .forEach((source) =>
            setTimeout(() => proxyManager.deleteProxy(source), 0)
          );
        setTimeout(() => {
          proxyManager.renderAllViews();
          proxyManager.resetCameraInAllViews();
        }, 0);
      },
      resetActiveCamera() {
        proxyManager.resetCamera();
      },
      increaseSlice({ state }) {
        if (state.route === 'app') {
          stepActiveSlice(proxyManager, true);
        }
      },
      decreaseSlice({ state }) {
        if (state.route === 'app') {
          stepActiveSlice(proxyManager, false);
        }
      },
      takeScreenshot({ commit, state }, viewToUse = null) {
        const view = viewToUse || proxyManager.getActiveView();
        const viewType = viewHelper.getViewType(view);
        if (view) {
          return view.captureImage().then((imgSrc) => {
            commit('openScreenshotDialog', {
              imgSrc,
              viewName: view.getName(),
              viewData: {
                background: state.views.backgroundColors[viewType],
              },
            });
          });
        }
        return Promise.resolve();
      },
      takeScreenshotSilent({ state }, viewToUse = null) {
        const view = viewToUse || proxyManager.getActiveView();
        const viewType = viewHelper.getViewType(view);
        if (view) {
          return view.captureImage().then((imgSrc) => {
            return {
              imgSrc,
              viewName: view.getName(),
              viewData: {
                background: state.views.backgroundColors[viewType],
              },
            };
          });
        }
        return Promise.resolve(null);
      },
      setCameraViewPoints({ dispatch, state }, viewPoints) {
        state.cameraViewPoints = viewPoints;
        const keys = Object.keys(viewPoints);
        if (keys.length !== 0) {
          dispatch('changeCameraViewPoint', keys[0]);
          const interactionStyle = 'FirstPerson';
          dispatch('views/setInteractionStyle3D', interactionStyle);
        }
      },
      changeCameraViewPoint({ commit, getters, state }, viewPointKey) {
        const allViews = state.proxyManager.getViews();
        const pxManager = getters.proxyManager;
        const viewPoints = getters.cameraViewPoints[viewPointKey] || {};
        const camera = viewPoints.camera;
        const showSources = viewPoints.show;
        const hideSources = viewPoints.hide;
        const moveCameraPromiseList = [];

        allViews
          .filter((v) => v.getName() === 'default')
          .forEach((v) => {
            const distance = v.getCamera().getDistance();
            const direction = [
              camera.focalPoint[0] - camera.position[0],
              camera.focalPoint[1] - camera.position[1],
              camera.focalPoint[2] - camera.position[2],
            ];
            const adjustedFocalPoint = [
              camera.position[0] + direction[0] * distance,
              camera.position[1] + direction[1] * distance,
              camera.position[2] + direction[2] * distance,
            ];
            const promise = v.moveCamera(
              adjustedFocalPoint,
              camera.position,
              camera.viewUp,
              100
            );
            moveCameraPromiseList.push(promise);
          });

        Promise.all(moveCameraPromiseList).then(() => {
          pxManager.getSources().forEach((source) => {
            const name = source.getName();
            if (!showSources.includes(name) && !hideSources.includes(name)) {
              return;
            }
            const visible = showSources.includes(name);
            const rep = pxManager
              .getRepresentations()
              .filter((r) => r.getInput() === source)[0];
            if (rep.getVisibility() !== visible) {
              rep.setVisibility(visible);
            }
          });
          pxManager.renderAllViews();
        });
        commit('mostRecentViewPoint', viewPointKey);
      },
      previousViewPoint({ dispatch, getters }) {
        const lastViewPoint = getters.mostRecentViewPoint;
        if (!lastViewPoint) return;
        const keys = Object.keys(getters.cameraViewPoints);
        if (!keys.includes(lastViewPoint)) return;
        const length = keys.length;
        const ind = (keys.indexOf(lastViewPoint) + length - 1) % length;
        dispatch('changeCameraViewPoint', keys[ind]);
      },
      nextViewPoint({ dispatch, getters }) {
        const lastViewPoint = getters.mostRecentViewPoint;
        if (!lastViewPoint) return;
        const keys = Object.keys(getters.cameraViewPoints);
        if (!keys.includes(lastViewPoint)) return;
        const ind = (keys.indexOf(lastViewPoint) + 1) % keys.length;
        dispatch('changeCameraViewPoint', keys[ind]);
      },
      rewriteProxyIds({ dispatch }, { appState, mapping }) {
        const extractMapping = (objs) =>
          objs.reduce(
            (map, obj) => ({ ...map, [obj.id]: mapping[obj.id] }),
            {}
          );
        const sourcesMapping = extractMapping(appState.sources);
        const viewsMapping = extractMapping(appState.views);
        const repsMapping = extractMapping(appState.representations);
        const maps = {
          sources: sourcesMapping,
          views: viewsMapping,
          reps: repsMapping,
          all: mapping,
        };
        dispatch('widgets/rewriteProxyIds', maps);
        dispatch('views/rewriteProxyIds', maps);
      },
    },
  });

  proxyManager.set({ $store }, true);
  return $store;
}

export default createStore;
