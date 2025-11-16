import DragAndDrop from 'paraview-glance/src/components/widgets/DragAndDrop';
import api from 'paraview-glance/src/api/api';
import { mapGetters } from 'vuex';

export default {
  name: 'Landing',
  components: {
    DragAndDrop,
  },
  data() {
    return {
      samples: [],
      version: window.GLANCE_VERSION || 'no version available',

      editDialog: false,
      editForm: {
        id: null,
        label: '',
        description: '',
        acknowledgement: '',
        isPublic: false,
      },

      editSnackbar: false,
      editSnackbarMessage: '',
      editSnackbarColor: 'error',

      responseMessage: null,
    };
  },
  async created() {
    const token = localStorage.getItem('jwt');
    console.log('Token en Landing:', token);
    if (token) {
      await this.loadPrivateFiles(token);
    } else {
      await this.loadPublicFiles();
    }
  },
  computed: {
    ...mapGetters('auth', ['isLoggedIn']),
  },
  methods: {
    async loadPublicFiles() {
      try {
        const response = await api.get('/files/public');
        console.log('Archivos públicos:', response.data);

        this.samples = response.data.map((file) => this.formatFile(file));
      } catch (error) {
        console.error('Error al cargar archivos públicos:', error);
      }
    },
    async loadPrivateFiles(token) {
      try {
        const response = await api.get('/files/private', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('Archivos privados:', response.data);

        this.samples = response.data.map((file) => this.formatFile(file));
        console.log('Muestras cargadas:', this.samples);
      } catch (error) {
        console.error('Error al cargar archivos públicos:', error);
      }
    },
    formatFile(file) {
      return {
        ...file,
        image: `http://localhost:8080/files/image/${file.id}`,
        datasetsJson: [
          {
            name: file.label,
            url: `http://localhost:8080/files/view/${file.id}`,
          },
        ],
        size: file.size
          ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
          : 'Desconocido',
      };
    },
    async openSample(sample) {
      if (!sample.datasetsJson || sample.datasetsJson.length === 0) {
        console.warn('El sample no tiene datasets');
        return;
      }

      const dataset = sample.datasetsJson[0];
      let url = dataset.url;
      const fileName = dataset.name;

      // Si es privado, añadimos el token como query param
      if (!sample.isPublic) {
        const token = localStorage.getItem('jwt');
        if (token) {
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}token=${token}`;
        }
      }

      console.log('Descargando archivo desde URL:', url);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al descargar ${fileName}: ${response.status}`);
        }

        const blob = await response.blob();
        const file = new File(
          [blob],
          fileName.endsWith('.glance') ? fileName : `${fileName}.glance`,
          {
            type: 'application/octet-stream',
          }
        );
        console.log('Archivo descargado:', file);
        // Emitimos directamente a openFileList del padre
        this.$emit('open-files', [file]);
      } catch (err) {
        console.error('Error al abrir el sample:', err);
      }
    },

    openEditDialog(sample) {
      this.editForm = {
        id: sample.id,
        label: sample.label,
        description: sample.description || '',
        acknowledgement: sample.acknowledgement || '',
        isPublic: sample.isPublic || false,
        image: null,
      };
      this.editDialog = true;
    },

    async saveFileChanges() {
      try {
        const updatedData = {
          label: this.editForm.label,
          description: this.editForm.description,
          acknowledgement: this.editForm.acknowledgement,
          isPublic: this.editForm.isPublic,
        };

        const response = await api.patch(
          `/files/${this.editForm.id}`,
          updatedData
        );

        console.log('Archivo actualizado:', response.data);
        this.editDialog = false;
        console.log('Archivo actualizado correctamente');

        // Actualizar la lista local
        const index = this.samples.findIndex((f) => f.id === this.editForm.id);
        if (index !== -1) {
          this.samples[index] = this.formatFile(response.data);
        }

        this.editSnackbarMessage = 'Archivo actualizado correctamente';
        this.editSnackbarColor = 'success';
        this.editSnackbar = true;
      } catch (error) {
        console.error('Error al actualizar archivo:', error);
        this.editSnackbarMessage =
          error.response?.data ||
          'Error al actualizar archivo, no puede ser publico y no defaced.';
        this.editSnackbarColor = 'error';
        this.editSnackbar = true;
      }
    },

    // Eliminar archivo (DELETE)
    async deleteFile(sample) {
      const token = localStorage.getItem('jwt');

      /* eslint-disable no-restricted-globals */
      /* eslint-disable no-alert */
      if (!confirm(`¿Seguro que deseas eliminar "${sample.label}"?`)) return;

      try {
        await api.delete(`/files/${sample.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Archivo eliminado correctamente');

        // Quitar del array local
        this.samples = this.samples.filter((f) => f.id !== sample.id);
        this.editSnackbarMessage = 'Archivo eliminado correctamente';
        this.editSnackbarColor = 'success';
        this.editSnackbar = true;
      } catch (error) {
        console.error('Error al eliminar archivo:', error);

        this.editSnackbarMessage =
          error.response?.data || 'Error al eliminar archivo';
        this.editSnackbarColor = 'error';
        this.editSnackbar = true;
      }
    },

    async executeScript() {
      this.responseMessage = 'Contactando al servidor...';

      try {
        // Usamos la instancia 'api' que ya tienes importada
        const response = await api.get('/deface/execute');
        this.responseMessage = response.data;
      } catch (error) {
        console.error('Error al ejecutar el script:', error);

        if (error.response) {
          this.responseMessage =
            error.response.data || 'Error desconocido del servidor.';
        } else if (error.request) {
          this.responseMessage =
            'No se pudo conectar con el servidor. ¿Está encendido?';
        } else {
          this.responseMessage = `Error: ${error.message}`;
        }
      }
    },
  },
};
