import api from 'paraview-glance/src/api/api';

export default {
  name: 'LoginSuccess',
  data() {
    return {
      user: null,
    };
  },
  async mounted() {
    try {
      // Llamada al backend para obtener los datos del usuario
      const response = await api.get('/auth/login/success');
      this.user = response.data;

      // Guardar JWT en localStorage
      localStorage.setItem('jwt', this.user.token);

      // Esperar 3 segundos y redirigir a la pestaña app
      setTimeout(() => {
        this.$router.push({ name: '/' }); // asegúrate de que tu ruta se llame 'App'
      }, 3000);
    } catch (error) {
      console.error('Error al obtener datos de login:', error);
    }
  },
};
