import { createStore } from 'vuex';
import api from '../api/api.js';

export default createStore({
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
      const response = await api.post('/auth/login', { username, password });
      const token = response.data.token;
      commit('setToken', token);
      commit('setUser', { username });
      return token;
    },
    loginGoogle() {
      window.location.href =
        'http://localhost:8080/oauth2/authorization/google';
    },
    async fetchGoogleLogin({ commit }) {
      const response = await api.get('/auth/login/success');
      const token = response.data.token;
      commit('setToken', token);
      commit('setUser', {
        username: response.data.username,
        name: response.data.name,
        picture: response.data.picture,
      });
      return response.data;
    },
    logout({ commit }) {
      commit('logout');
    },
  },
  getters: {
    isLoggedIn: (state) => !!state.token,
    getUser: (state) => state.user,
  },
});
