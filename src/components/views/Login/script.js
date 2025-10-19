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
    ...mapActions(['loginLocal']),

    async loginSuccess() {
      try {
        // Llamar a la acción de Vuex para login local
        await this.loginLocal({
          username: this.email,
          password: this.password,
        });
        // Emitir al componente padre que el login ha sido exitoso
        this.$emit('login-success');
      } catch (err) {
        console.error('Error login local:', err);
        alert('Usuario o contraseña incorrectos');
      }
    },
  },
};
