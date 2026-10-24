# ~/.bashrc di dalam container terminal
export PS1='\[\e[1;32m\]\u@term\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ '
export TERM=xterm-256color
export EDITOR=nano
export PATH="$HOME/.local/bin:$PATH"

alias ll='ls -alF'
alias la='ls -A'
alias ..='cd ..'
alias ...='cd ../..'
alias gs='git status -sb'
alias gl='git log --oneline --graph --decorate -20'
alias py='python3'

if command -v dircolors >/dev/null 2>&1; then
  eval "$(dircolors -b)"
  alias ls='ls --color=auto'
  alias grep='grep --color=auto'
fi

if [ -n "$PS1" ]; then
  echo "Terminal siap — ketik 'exit' untuk keluar. Coba: htop, tmux, python3"
fi
