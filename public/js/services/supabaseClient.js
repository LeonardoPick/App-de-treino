/**
 * supabaseClient.js
 * Cliente de integração com Supabase (@supabase/supabase-js) para Autenticação (E-mail e Senha)
 * e persistência nas tabelas `routines` e `workout_logs`.
 * Suporta variáveis de ambiente da Vercel (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 * ou configuração direta na interface.
 */

const CONFIG_STORAGE_KEY = 'workout_supabase_config_v1';

class SupabaseService {
  constructor() {
    this.client = null;
    this.user = null;
    this.isConfigured = false;
    this.authListeners = new Set();
    this.initPromise = this.init();
  }

  /**
   * Resolve as credenciais do Supabase a partir de variáveis de ambiente (Vercel/Vite)
   * ou configuração salva.
   */
  getCredentials() {
    // 1. Variáveis injetadas no build (Vite / Vercel) ou em window.__ENV__
    let envUrl = '';
    let envKey = '';

    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        envUrl = import.meta.env.VITE_SUPABASE_URL || '';
        envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      }
    } catch (e) {}

    if (!envUrl && window.__ENV__) {
      envUrl = window.__ENV__.VITE_SUPABASE_URL || '';
      envKey = window.__ENV__.VITE_SUPABASE_ANON_KEY || '';
    }

    if (envUrl && envKey) {
      return { url: envUrl.trim(), anonKey: envKey.trim() };
    }

    // 2. Fallback: Configuração salva pelo usuário na tela de Nuvem
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url && parsed.anonKey) {
          return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
        }
      }
    } catch (e) {}

    return { url: '', anonKey: '' };
  }

  saveCredentials(url, anonKey) {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
      url: url.trim(),
      anonKey: anonKey.trim()
    }));
    return this.init();
  }

  clearCredentials() {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    this.client = null;
    this.user = null;
    this.isConfigured = false;
    this.notifyAuthListeners();
  }

  async init() {
    const { url, anonKey } = this.getCredentials();
    if (!url || !anonKey) {
      this.isConfigured = false;
      this.client = null;
      return null;
    }

    try {
      // Importa @supabase/supabase-js via ESM CDN oficial (compatível com browser puro e Vite/Vercel)
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      this.client = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      this.isConfigured = true;

      // Recupera sessão ativa se existir
      const { data } = await this.client.auth.getSession();
      this.user = data?.session?.user || null;
      this.notifyAuthListeners();

      // Escuta mudanças de autenticação (login, logout, refresh de token)
      this.client.auth.onAuthStateChange((_event, session) => {
        this.user = session?.user || null;
        this.notifyAuthListeners();
      });

      return this.client;
    } catch (err) {
      console.warn('Modo offline ativo ou falha ao carregar SDK do Supabase:', err);
      this.isConfigured = Boolean(url && anonKey);
      return null;
    }
  }

  onAuthChange(callback) {
    this.authListeners.add(callback);
    callback(this.user, this.isConfigured);
    return () => this.authListeners.delete(callback);
  }

  notifyAuthListeners() {
    this.authListeners.forEach(cb => {
      try {
        cb(this.user, this.isConfigured);
      } catch (e) {}
    });
  }

  async signUp(email, password) {
    await this.initPromise;
    if (!this.client) throw new Error('Cliente Supabase não configurado.');
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    await this.initPromise;
    if (!this.client) throw new Error('Cliente Supabase não configurado.');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user;
    this.notifyAuthListeners();
    return data;
  }

  async signOut() {
    if (this.client) {
      await this.client.auth.signOut();
    }
    this.user = null;
    this.notifyAuthListeners();
  }
}

export const supabaseService = new SupabaseService();
