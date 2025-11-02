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
      showLoginSuccess: false,
      showRegisterSuccess: false,
      user: null,
    };
  },
  mounted() {
    this.checkAuthSuccess();
  },
  methods: {
    async enterAnonymous() {
      try {
        this.$emit('enter-anonymous');
      } catch (error) {
        console.error('Error al obtener archivos públicos:', error);
      }
    },
    handleLoginSuccess(user) {
      this.user = user;
      this.showLoginSuccess = true;

      setTimeout(() => {
        this.showLoginSuccess = false;
        this.$emit('login-success');
      }, 3000);
    },
    handleRegisterSuccess(user) {
      this.user = user;
      this.showRegisterSuccess = true;

      setTimeout(() => {
        this.showRegisterSuccess = false;
        this.$emit('register-success');
      }, 3000);
    },
    loginWithGoogle() {
      localStorage.removeItem('jwt');
      // Redirige al endpoint OAuth2 de tu backend
      window.location.href =
        'http://localhost:8080/oauth2/authorization/google';
    },
    async checkAuthSuccess() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'success') {
        try {
          const response = await api.get('/auth/login/success');
          const user = response.data;
          localStorage.setItem('jwt', user.token);

          console.log('Foto de usuario:', response.data.picture);

          this.handleLoginSuccess(user);
        } catch (error) {
          console.error('Error al obtener datos de login:', error);
        }
      }
    },
  },
};
