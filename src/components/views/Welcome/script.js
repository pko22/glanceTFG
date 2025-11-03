import Login from 'paraview-glance/src/components/views/Login';
import Register from 'paraview-glance/src/components/views/Register';

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
        const token = params.get('token');
        const name = decodeURIComponent(params.get('name') || '');
        const picture = decodeURIComponent(params.get('picture') || '');

        if (token) {
          // Guarda el token en localStorage
          localStorage.setItem('jwt', token);

          // Crea el objeto de usuario
          const user = { name, picture, token };

          // Limpia la URL (opcional pero recomendable)
          window.history.replaceState({}, document.title, '/');

          console.log('Login con Google exitoso:', user);

          this.handleLoginSuccess(user);
        }
      }
    },
  },
};
