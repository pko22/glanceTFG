import { mapActions } from 'vuex';

export default {
  name: 'Register',
  data() {
    return {
      email: '',
      password: '',
      passwordConfirm: '',
      valid: false,
      serverError: null,
      rules: {
        required: (v) => !!v || 'Campo requerido',
        email: (v) => /.+@.+\..+/.test(v) || 'Debe ser un email válido',
        minLength: (v) => (v && v.length >= 6) || 'Mínimo 6 caracteres',
        passwordMatch: (v) =>
          v === this.password || 'Las contraseñas no coinciden',
      },

      snackbar: false,
      snackbarMessage: '',
      snackbarColor: 'error',
    };
  },
  methods: {
    ...mapActions('auth', ['register']),

    async registerUser() {
      // Limpiamos el error previo al intentar un nuevo registro
      this.serverError = null;

      if (
        !this.email ||
        !this.password ||
        this.password !== this.passwordConfirm
      ) {
        this.showSnackbar('Verifica los campos antes de continuar.', 'error');
        return;
      }

      try {
        const data = await this.register({
          username: this.email,
          password: this.password,
        });

        // Si todo va bien, emitimos el evento hacia el padre (como con login)
        this.$emit('register-success', data);
      } catch (err) {
        this.serverError = err.message || 'Error desconocido al registrarse.';
        console.error('Error detallado en registro:', err);
        this.showSnackbar(this.serverError, 'error');
      }
    },
    showSnackbar(message, color) {
      this.snackbarMessage = message;
      this.snackbarColor = color;
      this.snackbar = true;
    },
  },
};
