export default function FinancePage() {
  const items = [
    { label: "Recebido em setembro", value: "R$ 72.840", detail: "91% do previsto" },
    { label: "A receber", value: "R$ 38.420", detail: "58 mensalidades" },
    { label: "Em atraso", value: "R$ 9.760", detail: "21 responsáveis" },
  ];

  return (
    <div className="dashboard-content">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FINANCEIRO</span>
          <h2>Mensalidades</h2>
          <p>Visão financeira inicial da instituição.</p>
        </div>
        <button className="button button--primary">+ Nova cobrança</button>
      </div>

      <section className="finance-grid">
        {items.map((item) => (
          <article className="metric-card" key={item.label}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <span>{item.detail}</span>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PRÓXIMA FASE</span>
            <h2>Automação financeira</h2>
          </div>
        </div>
        <div className="empty-state">
          <span>↗</span>
          <h3>Integração de cobranças preparada para a próxima etapa</h3>
          <p>PIX, boleto, conciliação e notificações de vencimento entram na fase seguinte.</p>
        </div>
      </section>
    </div>
  );
}
