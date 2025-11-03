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
      } catch (error) {
        console.error('Error al cargar archivos públicos:', error);
      }
    },
    formatFile(file) {
      return {
        ...file,
        image: `http://localhost:8080/files/image/${file.id}`,
        datasets: [
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
    openSample(sample) {
      const urls = [];
      const names = [];

      // Ajusta esto según la estructura que devuelva tu backend
      for (let i = 0; i < sample.datasets.length; ++i) {
        urls.push(sample.datasets[i].url);
        names.push(sample.datasets[i].name);
      }

      this.$emit('open-urls', sample.label, urls, names);
    },
  },
};
