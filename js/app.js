/**
 * app.js
 * Orquestrador principal da aplicação Workout (Supabase Cloud + Fallback IndexedDB + PWA).
 */

import { storageService } from './services/storageService.js';
import { supabaseService } from './services/supabaseClient.js';
import { DashboardScreen } from './screens/dashboard.js';
import { RoutineManagerScreen } from './screens/routineManager.js';
import { LiveWorkoutScreen } from './screens/liveWorkout.js';
import { HistoryScreen } from './screens/history.js';

class App {
  constructor() {
    this.currentScreen = 'dashboard';
    this.screens = {
      dashboard: new DashboardScreen(this),
      routines: new RoutineManagerScreen(this),
      workout: new LiveWorkoutScreen(this),
      history: new HistoryScreen(this)
    };

    this.container = document.querySelector('#app-main-content');
    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindHeaderActions();
    this.updateHeaderStats();

    window.addEventListener('workout-data-saved', () => {
      this.updateHeaderStats();
    });

    window.addEventListener('storage-synced', () => {
      this.updateHeaderStats();
      const activeWorkout = storageService.getActiveWorkout();
      if (activeWorkout && !this.screens.workout.workoutState) {
        this.screens.workout.resumeSession(activeWorkout);
        this.navigate('workout');
        return;
      }
      // Se o usuário estiver editando uma rotina no momento, não reseta a tela de edição
      if (this.currentScreen === 'routines' && this.screens.routines?.editingRoutine) {
        return;
      }
      this.screens[this.currentScreen]?.render(this.container);
    });

    window.addEventListener('cloud-sync-status', (e) => {
      this.updateCloudBadge(e.detail?.status);
    });

    // Observa mudanças no estado de autenticação do Supabase
    supabaseService.onAuthChange((user, isConfigured) => {
      this.renderAuthModalSection(user, isConfigured);
      this.updateCloudBadge(user ? 'synced' : 'offline-cache');
    });

    const activeWorkout = storageService.getActiveWorkout();
    if (activeWorkout) {
      this.screens.workout.resumeSession(activeWorkout);
      this.navigate('workout');
      return;
    }

    this.navigate('dashboard');
  }

  updateHeaderStats() {
    const logs = storageService.getWorkoutLogs();
    const countEl = document.querySelector('#header-workout-count');
    if (countEl) {
      countEl.textContent = logs.length;
    }
  }

  updateCloudBadge(status) {
    const authLabel = document.querySelector('#header-auth-label');
    const dot = document.querySelector('#cloud-status-dot');
    if (!authLabel) return;

    if (supabaseService.user) {
      if (status === 'syncing') {
        authLabel.textContent = 'Sincronizando...';
      } else {
        authLabel.textContent = 'Sincronizado';
      }
      if (dot) dot.style.backgroundColor = '#30D158';
    } else {
      authLabel.textContent = 'Entrar';
      if (dot) dot.style.backgroundColor = '#0A84FF';
    }
  }

  renderAuthModalSection(user, isConfigured) {
    const section = document.querySelector('#supabase-auth-section');
    if (!section) return;

    // Preenche inputs de credenciais atuais se existirem
    const creds = supabaseService.getCredentials();
    const urlInput = document.querySelector('#sb-url-input');
    const keyInput = document.querySelector('#sb-key-input');
    if (urlInput && creds.url) urlInput.value = creds.url;
    if (keyInput && creds.anonKey) keyInput.value = creds.anonKey;

    if (!isConfigured) {
      section.innerHTML = `
        <div class="space-y-2">
          <div class="font-semibold text-amber-400">Conectar ao Supabase</div>
          <p class="text-zinc-400 leading-relaxed">
            Para habilitar login por e-mail/senha e sincronização entre dispositivos nas tabelas <code>routines</code> e <code>workout_logs</code>, configure as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> na Vercel ou abra a aba <strong>"Configurar URL e Anon Key do Supabase"</strong> abaixo.
          </p>
        </div>
      `;
      return;
    }

    if (user) {
      section.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <span class="apple-badge-green">Conectado na Nuvem</span>
              <div class="text-sm font-semibold text-white mt-1.5">${user.email}</div>
            </div>
            <button type="button" id="btn-sb-logout" class="btn-secondary px-3.5 py-2 rounded-full text-xs text-red-400">
              Sair
            </button>
          </div>
          <div class="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <span class="text-[11px] text-zinc-400">Tabelas ativas: <code>routines</code>, <code>workout_logs</code></span>
            <button type="button" id="btn-sb-force-sync" class="text-xs text-purple-400 font-semibold">
              Sincronizar agora
            </button>
          </div>
        </div>
      `;

      section.querySelector('#btn-sb-logout')?.addEventListener('click', async () => {
        await supabaseService.signOut();
      });

      section.querySelector('#btn-sb-force-sync')?.addEventListener('click', async () => {
        await storageService.flushSyncQueue();
        await storageService.syncFromSupabase();
        alert('Sincronização com o Supabase concluída!');
      });
      return;
    }

    // Formulário de Login / Cadastro por E-mail e Senha
    section.innerHTML = `
      <form id="sb-auth-form" class="space-y-3">
        <div class="font-semibold text-white text-sm">Conta na Nuvem (E-mail e Senha)</div>
        <div class="space-y-2">
          <input 
            type="email" 
            id="sb-auth-email" 
            required
            class="input-dark w-full px-3.5 py-2.5 text-sm" 
            placeholder="Seu e-mail"
          />
          <input 
            type="password" 
            id="sb-auth-password" 
            required
            minlength="6"
            class="input-dark w-full px-3.5 py-2.5 text-sm" 
            placeholder="Sua senha (mín. 6 caracteres)"
          />
        </div>
        <div id="sb-auth-feedback" class="text-[11px] text-zinc-400 hidden"></div>
        <div class="flex items-center gap-2 pt-1">
          <button type="submit" data-auth-mode="signin" class="btn-primary flex-1 py-2.5 rounded-xl font-semibold text-xs">
            Entrar
          </button>
          <button type="button" id="btn-sb-signup" class="btn-secondary flex-1 py-2.5 rounded-xl font-semibold text-xs">
            Criar Conta
          </button>
        </div>
      </form>
    `;

    const form = section.querySelector('#sb-auth-form');
    const emailInput = section.querySelector('#sb-auth-email');
    const passInput = section.querySelector('#sb-auth-password');
    const feedback = section.querySelector('#sb-auth-feedback');

    const showFeedback = (msg, isError = false) => {
      if (!feedback) return;
      feedback.textContent = msg;
      feedback.className = `text-[11px] block ${isError ? 'text-red-400' : 'text-emerald-400'}`;
    };

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        showFeedback('Autenticando no Supabase...');
        await supabaseService.signIn(emailInput.value.trim(), passInput.value);
        showFeedback('Login realizado com sucesso!');
      } catch (err) {
        showFeedback(err.message || 'Erro ao fazer login.', true);
      }
    });

    section.querySelector('#btn-sb-signup')?.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const pass = passInput.value;
      if (!email || pass.length < 6) {
        showFeedback('Preencha um e-mail válido e senha com no mínimo 6 caracteres.', true);
        return;
      }
      try {
        showFeedback('Criando conta no Supabase...');
        await supabaseService.signUp(email, pass);
        showFeedback('Conta criada! Verifique seu e-mail ou clique em Entrar.');
      } catch (err) {
        showFeedback(err.message || 'Erro ao criar conta.', true);
      }
    });
  }

  navigate(screenName) {
    if (!this.screens[screenName]) return;
    this.currentScreen = screenName;

    document.querySelectorAll('[data-nav-target]').forEach(btn => {
      const target = btn.getAttribute('data-nav-target');
      if (target === screenName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.screens[screenName].render(this.container);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startWorkout(routineId) {
    this.screens.workout.startNewSession(routineId);
    this.navigate('workout');
  }

  openHistoryLogDetail(logId) {
    const logs = storageService.getWorkoutLogs();
    const found = logs.find(l => l.id === logId);
    if (found) {
      this.screens.history.activeTab = 'sessions';
      this.screens.history.selectedLogDetail = found;
      this.navigate('history');
    }
  }

  bindNavigation() {
    document.querySelectorAll('[data-nav-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-nav-target');
        this.navigate(target);
      });
    });
  }

  bindHeaderActions() {
    document.querySelector('#btn-logo-home')?.addEventListener('click', () => {
      this.navigate('dashboard');
    });

    document.querySelector('#btn-streak-history')?.addEventListener('click', () => {
      this.navigate('history');
    });

    const modal = document.querySelector('#mobile-guide-modal');
    const openModal = () => modal?.classList.remove('hidden');
    const closeModal = () => modal?.classList.add('hidden');

    document.querySelector('#btn-mobile-guide')?.addEventListener('click', openModal);
    document.querySelector('#btn-close-mobile-guide')?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Salvar URL e Anon Key do Supabase
    document.querySelector('#btn-save-sb-config')?.addEventListener('click', async () => {
      const url = document.querySelector('#sb-url-input')?.value || '';
      const key = document.querySelector('#sb-key-input')?.value || '';
      if (!url || !key) {
        alert('Informe a URL e a Anon Key do seu projeto Supabase.');
        return;
      }
      await supabaseService.saveCredentials(url, key);
      alert('Conexão com o Supabase configurada com sucesso!');
    });

    document.querySelector('#modal-btn-export')?.addEventListener('click', () => {
      const jsonStr = storageService.exportAllData();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    document.querySelector('#modal-input-import')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const res = await storageService.importAllData(ev.target.result);
        if (res.success) {
          alert('✓ Treinos e rotinas importados com sucesso!');
          this.updateHeaderStats();
          closeModal();
          this.navigate(this.currentScreen);
        } else {
          alert('Erro ao importar: ' + res.error);
        }
      };
      reader.readAsText(file);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.hypertrophyApp = new App();
});
