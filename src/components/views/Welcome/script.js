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
    };
  },
  methods: {
    enterAnonymous() {
      this.$emit('enter-anonymous');
    },
    handleLoginSuccess() {
      this.$emit('login-success');
    },
    handleRegisterSuccess() {
      this.$emit('register-success');
    },
  },
};
