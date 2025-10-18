export default {
  name: 'Login',
  data() {
    return {
      email: '',
      password: '',
      valid: false,
      rules: {
        required: (v) => !!v || 'Campo requerido',
        email: (v) => /.+@.+\..+/.test(v) || 'Debe ser un email válido',
      },
    };
  },
  methods: {
    loginSuccess() {
      const user = {
        email: this.email,
        password: this.password,
      };
      this.$emit('login-success', user);
    },
  },
};
