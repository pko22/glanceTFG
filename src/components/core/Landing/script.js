import DragAndDrop from 'paraview-glance/src/components/widgets/DragAndDrop';
import api from 'paraview-glance/src/api/api';

export default {
  name: 'Landing',
  components: {
    DragAndDrop,
  },
  data() {
    return {
      samples: [],
      version: window.GLANCE_VERSION || 'no version available',
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
  },
};
