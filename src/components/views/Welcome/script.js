import Login from 'paraview-glance/src/components/views/Login';
import Register from 'paraview-glance/src/components/views/Register';
import api from 'paraview-glance/src/api/api';

export default {
  name: 'Welcome',
  components: {
    Login,
    Register,
  },
  data() {
    return {
      showLogin: false,
      showRegister: false,
    };
  },
  methods: {
    async enterAnonymous() {
      try {
        const response = await api.get('/files/public');
        const archivos = response.data;
        console.log('Archivos públicos:', archivos);
        this.$emit('enter-anonymous', archivos);
      } catch (error) {
        console.error('Error al obtener archivos públicos:', error);
      }
    },
    handleLoginSuccess() {
      this.$emit('login-success');
    },
    handleRegisterSuccess() {
      this.$emit('register-success');
    },
    loginWithGoogle() {
      // Redirige al endpoint OAuth2 de tu backend
      window.location.href =
        'http://localhost:8080/oauth2/authorization/google';
    },
  },
};
