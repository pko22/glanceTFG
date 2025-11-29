import { mapGetters, mapState, mapActions, mapMutations } from 'vuex';
import Mousetrap from 'mousetrap';
import { VBottomSheet, VDialog } from 'vuetify/lib';
import macro from '@kitware/vtk.js/macro';

import AboutBox from 'paraview-glance/src/components/core/AboutBox';

import UserCrudBox from 'paraview-glance/src/components/views/userCrudBox';

import BrowserIssues from 'paraview-glance/src/components/core/BrowserIssues';
import ControlsDrawer from 'paraview-glance/src/components/core/ControlsDrawer';
import DragAndDrop from 'paraview-glance/src/components/widgets/DragAndDrop';
import ErrorBox from 'paraview-glance/src/components/core/ErrorBox';
import FileLoader from 'paraview-glance/src/components/core/FileLoader';
import Landing from 'paraview-glance/src/components/core/Landing';
import LayoutView from 'paraview-glance/src/components/core/LayoutView';
import Screenshots from 'paraview-glance/src/components/core/Screenshots';
import StateFileGenerator from 'paraview-glance/src/components/core/StateFileGenerator';
import SvgIcon from 'paraview-glance/src/components/widgets/SvgIcon';
import CollapsibleToolbar from 'paraview-glance/src/components/widgets/CollapsibleToolbar';
import CollapsibleToolbarItem from 'paraview-glance/src/components/widgets/CollapsibleToolbar/Item';

import shortcuts from 'paraview-glance/src/shortcuts';
import api from 'paraview-glance/src/api/api';
import Welcome from 'paraview-glance/src/components/views/Welcome';

// ----------------------------------------------------------------------------
// Component API
// ----------------------------------------------------------------------------

export default {
  name: 'App',
  components: {
    AboutBox,

    UserCrudBox,

    BrowserIssues,
    CollapsibleToolbar,
    CollapsibleToolbarItem,
    ControlsDrawer,
    DragAndDrop,
    ErrorBox,
    FileLoader,
    Landing,
    LayoutView,
    Screenshots,
    StateFileGenerator,
    SvgIcon,
    VBottomSheet,
    VDialog,

    // Nuevos componentes de login/welcome
    Welcome,
  },
  provide() {
    return {
      $notify: this.notify,
    };
  },
  data() {
    return {
      aboutDialog: false,
      errorDialog: false,
      fileUploadDialog: false,
      autoloadDialog: false,
      openFileDialog: false,
      autoloadLabel: '',
      openFileLabel: '',
      progressFinished: false,
      internalControlsDrawer: true,
      screenshotsDrawer: false,
      screenshotCount: 0,
      errors: [],
      globalSingleNotification: '',
      notifyPermanent: false,

      currentScreen: 'welcome', // 'welcome','app'
      userCrudDialog: false, // Diálogo de gestión de perfil
    };
  },
  computed: {
    controlsDrawer: {
      get() {
        return this.landingVisible ? false : this.internalControlsDrawer;
      },
      set(visible) {
        if (!this.landingVisible) {
          this.internalControlsDrawer = visible;
        }
      },
    },
    ...mapGetters('auth', {
      isLoggedIn: 'isLoggedIn',
      getUser: 'getUser',
    }),
    ...mapState({
      loadingState: 'loadingState',
      landingVisible: (state) => state.route === 'landing',
      screenshotsDrawerStateless(state) {
        // Keep screenshot drawer open if screenshot was taken from
        // the "Capture Active View" button.
        return this.screenshotsDrawer && !!state.screenshotDialog;
      },
      smallScreen() {
        return this.$vuetify.breakpoint.smAndDown;
      },
      dialogType() {
        return this.smallScreen ? 'v-bottom-sheet' : 'v-dialog';
      },
    }),
    ...mapGetters('files', {
      anyFileLoadingErrors: 'anyErrors',
      fileLoadingProgress: 'totalProgress',
    }),
  },
  proxyManagerHooks: {
    onProxyModified() {
      if (!this.loadingState) {
        this.$proxyManager.autoAnimateViews();
      }
    },
  },
  created() {
    this.internalControlsDrawer = !this.smallScreen;
  },
  mounted() {
    console.log('Usuario en store tras login:', this.getUser);

    this.$root.$on('open_girder_panel', () => {
      this.fileUploadDialog = true;
    });
    this.initViews();
    this.initializeAnimations();

    // Verificar login guardado
    if (this.isLoggedIn) {
      this.currentScreen = 'app';
    }

    // attach keyboard shortcuts
    shortcuts.forEach(({ key, action }) =>
      Mousetrap.bind(key, (e) => {
        e.preventDefault();
        this.$store.dispatch(action);
      })
    );

    // listen for errors
    window.addEventListener('error', this.recordError);

    // listen for vtkErrorMacro
    macro.setLoggerFunction('error', (...args) => {
      this.recordError(args.join(' '));
      window.console.error(...args);
    });
  },
  beforeDestroy() {
    window.removeEventListener('error', this.recordError);
    shortcuts.forEach(({ key }) => Mousetrap.unbind(key));
  },
  methods: {
    ...mapMutations({
      showApp: 'showApp',
      showLanding: 'showLanding',
      toggleLanding() {
        if (this.landingVisible) {
          this.showApp();
        } else {
          this.showLanding();
        }
      },
    }),
    ...mapActions({
      saveState: 'saveState',
      initViews: 'views/initViews',
    }),
    ...mapActions('files', [
      'openFiles',
      'openRemoteFiles',
      'load',
      'resetQueue',
    ]),
    ...mapActions('animations', ['initializeAnimations']),
    showFileUpload() {
      this.fileUploadDialog = true;
    },
    openFileList(fileList) {
      if (!fileList || fileList.length === 0) return;

      this.openFileDialog = true;
      this.openFileLabel = fileList[0].name || 'Archivo';
      this.progressFinished = false;

      // Emular comportamiento de autoloadRemotes
      setTimeout(() => {
        this.openFiles(Array.from(fileList))
          .then(() => this.load())
          .then(() => {
            if (this.anyFileLoadingErrors) {
              this.$nextTick(() => {
                this.fileUploadDialog = true;
              });
            } else {
              this.doneLoadingFiles();
            }
          })
          .finally(() => {
            this.resetQueue();
            this.progressFinished = true;
            this.openFileDialog = false;
          });
      }, 10);
    },

    autoLoadRemotes(label, urls, names) {
      const remotes = urls.map((url, index) => ({
        name: names[index],
        url,
      }));

      console.log('Auto-loading remote files:', remotes);
      this.autoloadDialog = true;
      this.autoloadLabel = label;
      setTimeout(
        () =>
          this.openRemoteFiles(remotes)
            .then(() => this.load())
            .then(() => {
              if (this.anyFileLoadingErrors) {
                this.$nextTick(() => {
                  this.fileUploadDialog = true;
                });
              } else {
                this.doneLoadingFiles();
              }
            })
            .finally(() => {
              this.resetQueue();
              this.autoloadDialog = false;
            }),
        // hack to allow loading sample dialog to show up
        10
      );
    },
    doneLoadingFiles() {
      this.showApp();
    },
    recordError(error) {
      this.errors.push(error);
    },
    notify(msg, permanent = false) {
      if (this.globalSingleNotification) {
        this.globalSingleNotification = '';
        this.permanent = false;
      }
      this.$nextTick(() => {
        this.globalSingleNotification = msg;
        this.notifyPermanent = permanent;
      });
    },

    // Entrar sin login
    enterAnonymous() {
      this.currentScreen = 'app';
    },

    // Login exitoso
    loginSuccess() {
      console.log('RECOGO LOGINSUCCESS------');

      this.currentScreen = 'app';
      console.log('Usuario en store tras login---------:', this.getUser);
    },

    // Registro exitoso
    registerSuccess() {
      this.currentScreen = 'app';
    },
    // Volver al welcome
    async logout() {
      window.history.replaceState({}, document.title, '/');
      try {
        await api.post('/auth/logout');
        console.log('Sesión de backend limpiada.');
      } catch (error) {
        console.warn('Advertencia al limpiar sesión de backend:', error);
      }
      // 2. Eliminar *todos* los datasets
      if (this.$proxyManager) {
        const sources = this.$proxyManager.getSources();

        sources.forEach((source) => {
          console.log(`Eliminando dataset: ${source.getName()}`);
          this.$proxyManager.deleteProxy(source);
        });

        console.log('Todos los datasets han sido eliminados.');
      } else {
        console.error(
          'Error: $proxyManager no está disponible para limpiar datasets.'
        );
      }

      this.$store.dispatch('auth/logout');
      this.currentScreen = 'welcome';
    },
  },
};
