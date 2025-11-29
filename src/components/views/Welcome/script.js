import Login from 'paraview-glance/src/components/views/Login';
import Register from 'paraview-glance/src/components/views/Register';
import { mapActions, mapMutations } from 'vuex';

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
    ...mapActions('auth', ['loginGoogle', 'fetchGoogleLogin']),
    ...mapMutations('auth', ['setToken', 'setUser']),
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
    async loginWithGoogle() {
      localStorage.removeItem('jwt');
      await this.loginGoogle();
    },
    async checkAuthSuccess() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'success') {
        const token = params.get('token');
        const name = decodeURIComponent(params.get('name') || '');
        const email = decodeURIComponent(params.get('email') || '');
        const picture = decodeURIComponent(params.get('picture') || '');

        if (token) {
          console.log('Token recibido de Google:', token);
          console.log('NOMBRE recibido de Google:', name);
          console.log('EMAIL recibido de Google:', email);
          // Guardmos el usuario en el store
          this.setToken(token);
          this.setUser(email);
          const user = { email, picture, token };
          console.log('Login con Google exitoso:', user);

          this.handleLoginSuccess(user);
        }
      }
    },
  },
};
