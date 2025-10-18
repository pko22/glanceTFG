export default {
  name: 'Register',
  data() {
    return {
      email: '',
      password: '',
      passwordConfirm: '',
      valid: false,
      rules: {
        required: (v) => !!v || 'Campo requerido',
        email: (v) => /.+@.+\..+/.test(v) || 'Debe ser un email válido',
        minLength: (v) => (v && v.length >= 6) || 'Mínimo 6 caracteres',
        passwordMatch: (v) =>
          v === this.password || 'Las contraseñas no coinciden',
      },
    };
  },
  methods: {
    registerSuccess() {
      const user = {
        email: this.email,
        password: this.password,
      };
      this.$emit('register-success', user);
    },
  },
};
