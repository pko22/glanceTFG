import { mapGetters, mapActions } from 'vuex';
import api from 'paraview-glance/src/api/api';

export default {
  name: 'UserEditDialogBox',
  data() {
    return {
      loginLocal: true,
      email: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      valid: false,
      showDeleteDialog: false,
      snackbar: {
        show: false,
        text: '',
        color: 'red',
      },
      rules: {
        required: (v) => !!v || 'Campo obligatorio',
        email: (v) => /.+@.+\..+/.test(v) || 'Correo no válido',
        passwordMatch: (v) =>
          v === this.newPassword || 'Las contraseñas no coinciden',
      },
    };
  },
  computed: {
    ...mapGetters('auth', ['getUser']),
  },
  mounted() {
    console.log('Usuario actual en UserEditDialogBox:', this.getUser);
    if (this.getUser?.name) {
      this.email = this.getUser.name;
    }
    if (!this.email) {
      this.loginLocal = false;
      this.email = this.getUser;
    }

    console.log('Email cargado en el formulario:', this.email);
  },
  methods: {
    ...mapActions('auth', ['logout']),
    async saveChanges() {
      if (!this.loginLocal) {
        this.snackbar.text =
          'Los usuarios de google no pueden editar su perfil.';
        this.snackbar.color = 'red';
        this.snackbar.show = true;
        return;
      }
      // Validación básica
      if (!this.$refs.form.validate()) {
        this.snackbar.text =
          'Por favor completa todos los campos correctamente.';
        this.snackbar.color = 'red';
        this.snackbar.show = true;
        return;
      }

      if (this.newPassword && this.newPassword !== this.confirmPassword) {
        this.snackbar.text = 'Las nuevas contraseñas no coinciden.';
        this.snackbar.color = 'red';
        this.snackbar.show = true;
        return;
      }

      try {
        // Llamada al backend
        const payload = {
          username: this.getUser.name,
          password: this.oldPassword,
          newUsername:
            this.email !== this.getUser.name ? this.email : undefined,
          newPassword: this.newPassword || undefined,
        };

        const response = await api.put('/auth/update', payload);

        // Mostrar mensaje de éxito
        this.snackbar.text =
          response.data.message || 'Perfil actualizado correctamente';
        this.snackbar.color = 'green';
        this.snackbar.show = true;

        // this.$emit('save-success', response.data);
      } catch (error) {
        // Mostrar errores del backend
        const msg =
          (error.response &&
            error.response.data &&
            error.response.data.error) ||
          'Error al actualizar el usuario.';
        this.snackbar.text = msg;
        this.snackbar.color = 'red';
        this.snackbar.show = true;
      }
    },

    confirmDeleteUser() {
      this.showDeleteDialog = true;
    },
    async deleteUserConfirmed() {
      if (!this.oldPassword && this.loginLocal) {
        this.snackbar.text =
          'Por favor ingresa tu contraseña para eliminar la cuenta.';
        this.snackbar.color = 'red';
        this.snackbar.show = true;
        return;
      }
      if (!this.loginLocal) {
        try {
          const payload = {
            username: this.getUser,
          };
          await api.delete('/auth/delete', { data: payload });

          this.snackbar.text = 'Usuario eliminado correctamente.';
          this.snackbar.color = 'green';
          this.snackbar.show = true;

          this.logout();
          window.location.href = '/';
        } catch (err) {
          console.error('Error al eliminar usuario:', err);
          this.snackbar.text =
            err.response?.data?.error || 'Error al eliminar el usuario.';
          this.snackbar.color = 'red';
          this.snackbar.show = true;
        } finally {
          this.showDeleteDialog = false;
        }
      } else {
        try {
          const payload = {
            username: this.getUser.name,
            password: this.oldPassword,
          };
          await api.delete('/auth/delete', { data: payload });

          this.snackbar.text = 'Usuario eliminado correctamente.';
          this.snackbar.color = 'green';
          this.snackbar.show = true;

          this.logout();
          window.location.href = '/';
        } catch (err) {
          console.error('Error al eliminar usuario:', err);
          this.snackbar.text =
            err.response?.data?.error || 'Error al eliminar el usuario.';
          this.snackbar.color = 'red';
          this.snackbar.show = true;
        } finally {
          this.showDeleteDialog = false;
        }
      }
    },
  },
};
