# HyperOverload - Hypertrophy & Progressive Overload Tracker

Aplicativo web de alta fidelidade e ergonomia esportiva voltado para atletas e praticantes de musculação focados em **hipertrofia máxima** e **sobrecarga progressiva**.

---

## ⚡ Principais Funcionalidades

### 1. Dashboard e Calendário Semanal (Segunda a Domingo)
- Visualização dos 7 dias da semana com destaque automático para o dia atual (**HOJE**) e indicação de rotinas programadas.
- **Card do Treino do Dia:** exibe o treino agendado com os grupos musculares, total de séries categorizadas e botão de início rápido em 1 clique.
- Seletor flexível para executar qualquer outra rotina da grade caso queira antecipar ou trocar o treino do dia.

### 2. Gerenciador e Construtor de Rotinas
- Crie e edite rotinas completas (Treino A, B, C; Costas, Peito, Pernas, etc.).
- Para cada exercício:
  - Definição do tempo de descanso padrão (em segundos).
  - Estrutura completa de séries categorizadas:
    - 🟡 **Aquecimento (Warm-up):** ativação sinovial e fluxo sanguíneo.
    - 🔵 **Feeder Set:** preparação neuromuscular subindo carga sem fadiga acumulada.
    - 🟢 **Work Set:** séries de trabalho efetivas com alta tensão mecânica (RIR 1-2).
    - 🟣 **Top Set:** série principal com a carga mais pesada para superação de recorde (PR).
  - Adição, remoção e reordenação instantânea de séries para cima e para baixo.

### 3. Modo de Execução do Treino (Live Workout / Player)
- **Fluxo Sequencial por Exercício:** sequência guiada respeitando a ordem fisiológica (*Aquecimento $\rightarrow$ Feeder $\rightarrow$ Work $\rightarrow$ Top*).
- **Benchmark Histórico em Destaque:** consulta automática do banco de dados e exibição instantânea ao lado dos inputs:
  - `Último Desempenho`: carga e repetições da última sessão.
  - `Melhor Histórico (PR)`: recorde absoluto de carga naquele exercício e tipo de série.
- **Cronômetro de Descanso Regressivo:**
  - Disparado automaticamente ao clicar em **"Concluir Série"**.
  - Alerta sonoro de contagem regressiva nos últimos 3 segundos e campainha de término via **Web Audio API** (100% sintetizado, sem carregar arquivos MP3).
  - Controles de `+30s`, `-30s` e `Pular Descanso`.
- **Tratamento de Exceções:**
  - `Pular Série`: avança sem salvar dados inválidos.
  - `Resetar Exercício`: limpa o estado e reinicia a partir da primeira série caso haja necessidade de recomeçar.
  - `Concluir Treino`: salva o log consolidado com duração total, volume levantado (kg) e novos recordes batidos.

### 4. Histórico e Análise de Sobrecarga
- Lista cronológica detalhada de todos os treinos realizados.
- Ao clicar em uma sessão: modal completo com horários, exercícios, categorias de séries e cargas/placas utilizadas.
- **Filtro Individual por Exercício:**
  - Gráfico vetorial de linha (SVG nativo) mostrando a curva de evolução de carga máxima por sessão.
  - Tabela comparativa indicando o ganho de peso em relação à sessão anterior ($+\Delta$ kg).
- **Exportação e Importação:** backup completo em arquivo JSON.

---

## 🚀 Como Executar

### Opção 1: Servidor Local Node.js
```bash
cd hypertrophy-app
node server.js
```
Acesse no navegador: `http://localhost:3001`

### Opção 2: Clique Duplo no Windows
Dê dois cliques no arquivo `start.bat`.

### Opção 3: Abrir Diretamente no Navegador
Como o projeto é construído em ES6 modular nativo e CSS autocontido, você também pode abrir o arquivo `index.html` em qualquer navegador moderno.
