export const metrics = [
  { label: "Alunos ativos", value: "842", detail: "+18 este mês", tone: "blue" },
  { label: "Turmas", value: "31", detail: "Manhã, tarde e noite", tone: "violet" },
  { label: "Frequência média", value: "94,2%", detail: "+1,8% vs. agosto", tone: "green" },
  { label: "Mensalidades em dia", value: "91%", detail: "R$ 38,4 mil a receber", tone: "orange" },
];

export const students = [
  { name: "Ana Beatriz Lima", code: "20261042", className: "7º A", shift: "Manhã", status: "Ativo" },
  { name: "Carlos Henrique", code: "20260891", className: "9º B", shift: "Tarde", status: "Ativo" },
  { name: "Luiza Fernandes", code: "20261105", className: "6º A", shift: "Manhã", status: "Ativo" },
  { name: "Mateus Rocha", code: "20260417", className: "8º C", shift: "Tarde", status: "Pendente" },
  { name: "Sofia Martins", code: "20261088", className: "5º A", shift: "Manhã", status: "Ativo" },
];

export const classes = [
  { name: "6º A", teacher: "Mariana Alves", students: 29, room: "Sala 08", shift: "Manhã" },
  { name: "7º A", teacher: "Ricardo Nunes", students: 31, room: "Sala 10", shift: "Manhã" },
  { name: "8º C", teacher: "Amanda Souza", students: 28, room: "Sala 14", shift: "Tarde" },
  { name: "9º B", teacher: "Paulo Mendes", students: 30, room: "Sala 16", shift: "Tarde" },
];

export const attendance = [
  { className: "6º A", present: 28, absent: 1, rate: "96.6%" },
  { className: "7º A", present: 29, absent: 2, rate: "93.5%" },
  { className: "8º C", present: 26, absent: 2, rate: "92.9%" },
  { className: "9º B", present: 30, absent: 0, rate: "100%" },
];

export const recentActivity = [
  { title: "Novo aluno matriculado", detail: "João Pedro • 7º A", time: "há 12 min" },
  { title: "Frequência lançada", detail: "Turma 9º B • Matemática", time: "há 34 min" },
  { title: "Mensalidade recebida", detail: "R$ 680,00 • PIX", time: "há 1 h" },
  { title: "Nota atualizada", detail: "Avaliação de Ciências • 8º C", time: "há 2 h" },
];
