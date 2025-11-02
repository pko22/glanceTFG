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
    const token = localStorage.getItem('token');
    if (!token) {
      await this.loadPublicFiles();
    }
    /*
     else {
      await this.loadPublicFiles();
    }
      */
  },
  methods: {
    async loadPublicFiles() {
      try {
        const response = await api.get('/files/public');
        console.log('Archivos públicos:', response.data);

        this.samples = response.data.map((file) => ({
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
        }));
      } catch (error) {
        console.error('Error al cargar archivos públicos:', error);
      }
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
