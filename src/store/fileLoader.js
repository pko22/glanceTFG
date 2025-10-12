import JSZip from 'jszip';

import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';

import ReaderFactory from 'paraview-glance/src/io/ReaderFactory';
import postProcessDataset from 'paraview-glance/src/io/postProcessing';
import Vue from 'vue';

/*
  Un vuex es una clase donde puedes gestionar datos globales en toda la app.
  LA app esta recubierta con un componente que se llama dragAndDrop que permite cargar archivos en cualquirmoemnto,
  por esoo es que esta "clase global" nos ayuda tanto. Puedes compartir datos con tooooda la app aqui dentro



*/






// ----------------------------------------------------------------------------

function getSupportedExtensions() {
  return ['zip', 'raw', 'glance', 'gz'].concat(
    ReaderFactory.listSupportedExtensions()
  );
}

// ----------------------------------------------------------------------------

export function getExtension(filename) {
  const i = filename.lastIndexOf('.');
  if (i > -1) {
    return filename.substr(i + 1).toLowerCase();
  }
  return '';
}

// ----------------------------------------------------------------------------

function zipGetSupportedFiles(zip, path) {
  const supportedExts = getSupportedExtensions();
  const promises = [];
  zip.folder(path).forEach((relPath, file) => {
    if (file.dir) {
      promises.push(zipGetSupportedFiles(zip, relPath));
    } else if (supportedExts.indexOf(getExtension(file.name)) > -1) {
      const splitPath = file.name.split('/');
      const baseName = splitPath[splitPath.length - 1];
      promises.push(
        zip
          .file(file.name)
          .async('blob')
          .then((blob) => new File([blob], baseName))
      );
    }
  });
  return promises;
}

// ----------------------------------------------------------------------------

function readRawFile(file, { dimensions, spacing, dataType }) {
  return new Promise((resolve, reject) => {
    const fio = new FileReader();
    fio.onload = function onFileReaderLoad() {
      const dataset = vtkImageData.newInstance({
        spacing,
        extent: [
          0,
          dimensions[0] - 1,
          0,
          dimensions[1] - 1,
          0,
          dimensions[2] - 1,
        ],
      });
      const scalars = vtkDataArray.newInstance({
        name: 'Scalars',
        values: new dataType.constructor(fio.result),
      });
      dataset.getPointData().setScalars(scalars);

      resolve(dataset);
    };

    fio.onerror = (error) => reject(error);

    fio.readAsArrayBuffer(file);
  });
}

// ----------------------------------------------------------------------------


/*
Un store en vuex tiene siempre:
state-> variables "globales" del store
getters-> getter de las variablesç
mutations-> funciones que cambian esas variables globales(directsamente las cambian de valor o lo qiue sea) SIEMPRE SINCRONAS
actions-> funciones que realizanc operaciones mas complejas y pueden ser ASINCRONAS



Con esto lo que ganamos es trazabilidad en los fallos. Siempre debemos hacer commit para llmar a una mutacion,
que son los que cambian los datos globales del store.
Usando commit, cada cambio queda registrado y se puede depurar fácilmente (por ejemplo, con Vue DevTools).
*/
export default ({ proxyManager, girder }) => ({
  namespaced: true,

  //El state seran las variables globales del fileLoader global
  state: {
    remoteFileList: [],//archivos que se van a descargar de un servidor remoto
    fileList: [],//Archivos cargados o en cola para ser descargados
    loading: false,//Flag que indica si estas cargando archivos o no
    progress: {},//Para saber el progreso de descarga y poder poner un medidor
  },

  getters: {
    //Te dice si hay algun archivo con fallo
    anyErrors(state) {
      return state.fileList.reduce(
        (flag, file) => flag || file.state === 'error',
        false
      );
    },

    //Te devuelve el mnumero que representa el progreso de carga de archivos
    totalProgress(state) {
      const itemProgresses = Object.values(state.progress);
      if (itemProgresses.length === 0) {
        return 0;
      }
      return (
        itemProgresses.reduce((sum, val) => sum + val, 0) /
        itemProgresses.length
      );
    },
  },


  //Las mutatios son como las funciones que puedes hacer desde este vuex
  mutations: {

    //Para activar el flag de loading
    startLoading(state) {
      state.loading = true;
    },

    //Desactivar flag de loading
    stopLoading(state) {
      state.loading = false;
    },

    //resetea a 0 los archivos descargados o pendientes por descargar
    resetQueue(state) {
      state.fileList = [];
    },

    //Añade archivos a la cola de archivos por descargar
    addToFileList(state, files) {
      for (let i = 0; i < files.length; i++) {
        const fileInfo = files[i];


        //crear un dato llamado fileState con el archivo que queremos añadir(depende del tipo de archivo para ser añadido obviamente no es lo mismo un png que un dicom)
        const fileState = {
          // possible values: needsDownload, needsInfo, loading, ready, error
          state: 'loading',
          name: fileInfo.name,
          ext: getExtension(fileInfo.name),
          files: null,
          reader: null,
          extraInfo: null,
          remoteURL: null,
          withGirderToken: false,
          proxyKeys: fileInfo.proxyKeys,
        };

        if (fileInfo.type === 'dicom') {
          fileState.files = fileInfo.list;
        }
        if (fileInfo.type === 'remote') {
          Object.assign(fileState, {
            state: 'needsDownload',
            remoteURL: fileInfo.remoteURL,
            remoteOpts: fileInfo.remoteOpts || {},
            withGirderToken: !!fileInfo.withGirderToken,
          });
        }
        if (fileInfo.type === 'regular') {
          fileState.files = [fileInfo.file];
        }

        state.fileList.push(fileState);
      }
    },
    //Le cambia el state al archivo con el index indicado
    setFileNeedsInfo(state, index) {
      if (index >= 0 && index < state.fileList.length) {
        state.fileList[index].state = 'needsInfo';
        state.fileList[index].extraInfo = null;
      }
    },
    //Settea el state y el archivo al archivo con el index indicado( esto es para los datos remotos, cuando se termiinan de descargar)
    setRemoteFile(state, { index, file }) {
      if (index >= 0 && index < state.fileList.length) {
        state.fileList[index].state = 'loading';
        state.fileList[index].files = [file];
      }
    },
    //Le mete un reader especifico al archivo con el index en cuestion. Esto es para que vtk lo pueda leer bien
    setFileReader(state, { index, reader }) {
      if (reader && index >= 0 && index < state.fileList.length) {
        state.fileList[index].reader = reader;
        state.fileList[index].state = 'ready';
      }
    },
    //Esto es para meter mas info a un archivo raw, que necesita mas info para ser leido
    setRawFileInfo(state, { index, info }) {
      if (info && index >= 0 && index < state.fileList.length) {
        state.fileList[index].extraInfo = info;
        state.fileList[index].state = 'loading';
      }
    },
    //le pone un error al archivo en cuestion
    setFileError(state, { index, error }) {
      if (error && index >= 0 && index < state.fileList.length) {
        state.fileList[index].error = error;
        state.fileList[index].state = 'error';
      }
    },

    //Elimina un archivo de la lista de archivos
    deleteFile(state, index) {
      if (index >= 0 && index < state.fileList.length) {
        state.fileList.splice(index, 1);
      }
    },
    //Va a las variables del store, concretamente a la de progress, en el id determnado le pone el nuevo porcentage de carga
    setProgress(state, { id, percentage }) {
      Vue.set(state.progress, id, percentage);
    },
    //Elimina el valor de progreso de descargsa(lo borra pa todos)
    clearProgresses(state) {
      state.progress = {};
    },
  },

  actions: {

    //Abre el panel de seleccionar archivos locales que quieres cargar, crea una promesa que se resuelve cuando se elige obviamente
    promptLocal({ dispatch }) {
      const exts = getSupportedExtensions();
      return new Promise((resolve, reject) =>
        ReaderFactory.openFiles(exts, (files) => {
          dispatch('openFiles', Array.from(files)).then(resolve).catch(reject);
        })
      );
    },

    //llama a lamutacion de resetQueue
    resetQueue({ commit }) {
      commit('resetQueue');
    },

    //Llama a la mutacion de deleteFile
    deleteFile({ commit }, index) {
      commit('deleteFile', index);
    },
    //LLama a la mutacion de añadir un file a la cola de descarga. 
    // Ademas le pasa los datos del archivo remoto que se va a descargar
    //despues llama a otra funcion readAllFiles para leer todos los archivos(ESTA MAS ABAJO DEFINIDA)
    openRemoteFiles({ commit, dispatch }, remoteFiles) {
      commit(
        'addToFileList',
        remoteFiles.map((rfile) => ({
          type: 'remote',
          name: rfile.name,
          remoteURL: rfile.url,
          remoteOpts: rfile.options,
          withGirderToken: !!rfile.withGirderToken,
          // Key value pairs to be eventually set on the proxy
          proxyKeys: rfile.proxyKeys,
        }))
      );

      return dispatch('readAllFiles');
    },
  /*
    Separa archivos ZIP y otros archivos.(los zip los descomprime y va viendo si son compatibles)
    Combina los archivos descomprimidos con los no ZIP y vuelve a llamar openFiles para procesarlos uno a uno.
    
    Separa archivos DICOM (.dcm) de los archivos normales.Agrega los DICOM y archivos normales a fileList 
    usando addToFileList(es una mutacion).

    Llama a otra accion readAllFiles para empezar a procesar los archivos agregados(ESTA DEFINIDA MAS ABAJO)
  */
    openFiles({ commit, dispatch }, files) {
      const zips = files.filter((f) => getExtension(f.name) === 'zip');
      if (zips.length) {
        const nonzips = files.filter((f) => getExtension(f.name) !== 'zip');
        const p = zips.map((file) =>
          JSZip.loadAsync(file).then((zip) =>
            Promise.all(zipGetSupportedFiles(zip))
          )
        );
        return Promise.all(p)
          .then((results) => [].concat.apply(nonzips, results))
          .then((newFileList) => dispatch('openFiles', newFileList));
      }

      // split out dicom and single datasets
      // all dicom files are assumed to be from a single series
      const regularFileList = [];
      const dicomFileList = [];
      files.forEach((f) => {
        if (getExtension(f.name) === 'dcm') {
          dicomFileList.push(f);
        } else {
          regularFileList.push(f);
        }
      });

      if (dicomFileList.length) {
        const dicomFile = {
          type: 'dicom',
          name: dicomFileList[0].name, // pick first file for name
          list: dicomFileList,
        };
        commit('addToFileList', [dicomFile]);
      }

      commit(
        'addToFileList',
        regularFileList.map((f) => ({
          type: 'regular',
          name: f.name,
          file: f,
        }))
      );

      return dispatch('readAllFiles');
    },
    //recorre el array de fileList del las variables "globales" y va llamamndo a readFileIndex(OTRA ACCION DEFINIDA MAS ABAJO)
    readAllFiles({ dispatch, state }) {
      const readPromises = [];
      for (let i = 0; i < state.fileList.length; i++) {
        readPromises.push(dispatch('readFileIndex', i));
      }

      return Promise.all(readPromises);
    },

  /*
    Funcion encargada de leer cada archivo dependiendo de su estado y tipo

      tipo:needsDownload--->descarga el archivo remoto (con token Girder si aplica) y actualiza progreso.
      tipo:raw---> si tiene info adicional (extraInfo), llama a readRawFile y guarda el dataset.(Es una funcion declarada fuera del store)
      Tipo:dcm---> usa ReaderFactory.loadFileSeries para cargar un conjunto de DICOM.
      Tipo:--->glance: valida que solo haya un archivo de estado (glance), si hay más marca error.
      Tipo:Otros---> usa ReaderFactory.loadFiles para archivos regulares.

      Al finalizar, actualiza el estado del archivo (ready, error, etc.) mediante mutaciones.
  */
    readFileIndex({ commit, dispatch, state }, fileIndex) {
      const file = state.fileList[fileIndex];
      let ret = Promise.resolve();

      if (file.state === 'ready' || file.state === 'error') {
        return ret;
      }

      if (file.state === 'needsDownload' && file.remoteURL) {
        if (file.withGirderToken) {
          file.remoteOpts.headers = {
            ...file.remoteOpts.headers,
            'Girder-Token': girder.girderRest.token,
          };
        }
        ret = ReaderFactory.downloadDataset(file.name, file.remoteURL, {
          ...file.remoteOpts,
          progressCallback(progress) {
            const percentage = progress.lengthComputable
              ? progress.loaded / progress.total
              : Infinity;
            commit('setProgress', { id: file.name, percentage });
          },
        })
          .then((datasetFile) => {
            commit('setRemoteFile', {
              index: fileIndex,
              file: datasetFile,
            });
            // re-run ReadFileIndex on our newly downloaded file.
            return dispatch('readFileIndex', fileIndex);
          })
          .catch(() => {
            throw new Error('Failed to download file');
          });
      } else if (file.ext === 'raw') {
        if (file.extraInfo) {
          ret = readRawFile(file.files[0], file.extraInfo).then((ds) => {
            commit('setFileReader', {
              index: fileIndex,
              reader: {
                name: file.name,
                dataset: ds,
              },
            });
          });
        }
        commit('setFileNeedsInfo', fileIndex);
      } else if (file.ext === 'dcm') {
        ret = ReaderFactory.loadFileSeries(file.files, 'dcm', file.name).then(
          (r) => {
            if (r) {
              commit('setFileReader', {
                index: fileIndex,
                reader: r,
              });
            }
          }
        );
      } else {
        if (file.ext === 'glance') {
          // see if there is a state file before this one
          for (let i = 0; i < fileIndex; i++) {
            const f = state.fileList[i];
            if (f.ext === 'glance') {
              const error = new Error('Cannot load multiple state files');
              commit('setFileError', {
                index: fileIndex,
                error,
              });
              return ret;
            }
          }
        }

        ret = ReaderFactory.loadFiles(file.files).then((r) => {
          if (r && r.length === 1) {
            commit('setFileReader', {
              index: fileIndex,
              reader: r[0],
            });
          }
        });
      }

      return ret.catch((error) => {
        if (error) {
          commit('setFileError', {
            index: fileIndex,
            error: error.message || 'File load failure',
          });
        }
      });
    },
    //Le mete info adicional a archivos de tipo RAW o pone archivos a tipo NeedsInfo 
    // y vuelve a llamar a readFileIndex para que lo lea
    setRawFileInfo({ commit, dispatch }, { index, info }) {
      if (info) {
        commit('setRawFileInfo', { index, info });
      } else {
        commit('setFileNeedsInfo', index);
      }
      return dispatch('readFileIndex', index);
    },
  /*
    1) Marfca el flag a loading y limpia los progresos anteriores
    2) Filtra los archivos y solo coge  los que estan ready
    3) Si hay algun archivo con estado glance lo procesa el primero y restaura la app. Este tipo de archivo es el propio de la app
    4)Divide los archivos en:
      regularFiles → imágenes normales
      labelmapFiles → máscaras VTK
      measurementFiles → archivos de medición

    5)Llama a ReaderFactory.registerReadersToProxyManager para registrar los archivos como sources de VTK en el proxyManager.
    6)Recorre cada arry que antes ha separado y hace lo siguiente:
      Si hay labelmaps, los asigna a la última imagen cargada.
      Si hay measurements, los adjunta a la última imagen.
      (ESTO ES PORQUE PUEDE HABER ARCHIVOS CON MEDICIONES HECHAS EN LA APP Y SE DENBERAN CARGAR CON EL STORE DE WIDGETS)

    7)Al final, marca el fin de la carga (stopLoading).

    */
    load({ state, commit, dispatch }) {
      commit('startLoading');
      commit('clearProgresses');

      const readyFiles = state.fileList.filter((f) => f.state === 'ready');
      let promise = Promise.resolve();

      // load state file first
      const stateFile = readyFiles.find((f) => f.ext === 'glance');
      if (stateFile) {
        const reader = stateFile.reader.reader;
        promise = promise.then(() =>
          reader.parseAsArrayBuffer().then(() =>
            dispatch('restoreAppState', reader.getAppState(), {
              root: true,
            })
          )
        );
      }

      promise = promise.then(() => {
        const otherFiles = readyFiles.filter((f) => f.ext !== 'glance');
        const regularFiles = [];
        const labelmapFiles = [];
        const measurementFiles = [];
        for (let i = 0; i < otherFiles.length; i++) {
          const file = otherFiles[i];
          const meta = (file.proxyKeys && file.proxyKeys.meta) || {};
          if (meta.glanceDataType === 'vtkLabelMap') {
            labelmapFiles.push(file);
          } else if (file.name.endsWith('.measurements.json')) {
            measurementFiles.push(file);
          } else {
            regularFiles.push(file);
          }
        }

        const loadFiles = (fileList) => {
          let ret = [];
          for (let i = 0; i < fileList.length; i++) {
            const f = fileList[i];
            const readerBundle = {
              ...f.reader,
              metadata: f.reader.metadata || {},
            };

            if (f.remoteURL) {
              Object.assign(readerBundle.metadata, { url: f.remoteURL });
            }

            const meta = f.proxyKeys && f.proxyKeys.meta;
            if (meta) {
              const { reader, dataset } = readerBundle;
              const ds =
                reader && reader.getOutputData
                  ? reader.getOutputData()
                  : dataset;
              Object.assign(readerBundle, {
                // use dataset instead of reader
                dataset: postProcessDataset(ds, meta),
                reader: null,
              });
            }

            const sources = ReaderFactory.registerReadersToProxyManager(
              [{ ...readerBundle, proxyKeys: f.proxyKeys }],
              proxyManager
            );
            ret = ret.concat(sources.filter(Boolean));
          }
          return ret;
        };

        loadFiles(regularFiles);
        const loadedLabelmaps = loadFiles(labelmapFiles);

        const sources = proxyManager
          .getSources()
          .filter((p) => p.getProxyName() === 'TrivialProducer');

        // attach labelmaps to most recently loaded image
        if (sources[sources.length - 1]) {
          const lastSourcePID = sources[sources.length - 1].getProxyId();
          for (let i = 0; i < loadedLabelmaps.length; i++) {
            const lmProxy = loadedLabelmaps[i];
            dispatch(
              'widgets/addLabelmapToImage',
              {
                imageId: lastSourcePID,
                labelmapId: lmProxy.getProxyId(),
              },
              { root: true }
            ).then(() =>
              dispatch(
                'widgets/setLabelmapState',
                {
                  labelmapId: lmProxy.getProxyId(),
                  labelmapState: {
                    selectedLabel: 1,
                    lastColorIndex: 1,
                  },
                },
                { root: true }
              )
            );
          }

          // attach measurements to most recently loaded image
          for (let i = 0; i < measurementFiles.length; i++) {
            const measurements =
              measurementFiles[i].reader.reader.getOutputData();
            for (let m = 0; m < measurements.length; m++) {
              dispatch(
                'widgets/addMeasurementTool',
                {
                  datasetId: lastSourcePID,
                  componentName: measurements[m].componentName,
                  data: measurements[m].data,
                },
                { root: true }
              );
            }
          }
        }
      });

      return promise.finally(() => commit('stopLoading'));
    },
  },
});
