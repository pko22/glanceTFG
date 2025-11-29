import api from '../api/api';

export default {
  namespaced: true,
  state: {
    user: null,
    token: localStorage.getItem('jwt') || null,
  },
  mutations: {
    setUser(state, user) {
      state.user = user;
    },
    setToken(state, token) {
      state.token = token;
      localStorage.setItem('jwt', token);
    },
    logout(state) {
      state.user = null;
      state.token = null;
      localStorage.removeItem('jwt');
    },
  },
  actions: {
    async loginLocal({ commit }, { username, password }) {
      try {
        const response = await api.post('/auth/login', { username, password });
        const data = response.data;

        // Guardamos token y datos de usuario
        commit('setToken', data.token);
        commit('setUser', {
          name: data.name,
        });

        return data;
      } catch (error) {
        console.error('Error en loginLocal:', error);
        throw error;
      }
    },
    loginGoogle() {
      window.location.href =
        'http://localhost:8080/oauth2/authorization/google';
    },
    async register({ commit }, { username, password }) {
      try {
        const response = await api.post('/auth/register', {
          username,
          password,
        });
        const data = response.data;
        console.log('datros recibidor de register:', data);

        if (data.error) {
          throw new Error(data.error);
        }
        commit('setToken', data.token);
        commit('setUser', {
          name: data.username,
        });

        return data;
      } catch (error) {
        console.error('Error en register:', error);

        // 1. 🔍 Comprobar si el error es de Axios y si tiene respuesta del servidor
        if (
          error.response &&
          error.response.data &&
          error.response.data.error
        ) {
          // El backend devuelve un 409 Conflict con un body como: { "error": "El nombre de usuario ya está registrado." }

          // 2. Lanza una excepción con el mensaje de error del servidor.
          // Esto permite que el componente que llama a esta acción pueda capturar el mensaje exacto.
          throw new Error(error.response.data.error);
        }

        // Si es otro tipo de error (ej. 500, error de red), lanza el error original
        throw error;
      }
    },

    logout({ commit }) {
      commit('logout');
    },
  },
  getters: {
    isLoggedIn: (state) => !!state.token,
    getUser: (state) => state.user,
  },
};
