import { mapActions } from 'vuex';

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
    ...mapActions('auth', ['loginLocal']),

    async login() {
      try {
        // Llamar a la acción de Vuex para login local
        const userData = await this.loginLocal({
          username: this.email,
          password: this.password,
        });

        // Emitimos al componente padre con los datos del usuario
        this.$emit('login-success', userData);
      } catch (err) {
        console.error('Error login local:', err);
        alert('Usuario o contraseña incorrectos');
      }
    },
  },
};
