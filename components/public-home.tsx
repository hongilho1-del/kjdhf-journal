const workflow = [
  ["01", "투고", "저자 정보와 익명 원고를 분리해 안전하게 접수합니다."],
  ["02", "이중맹검 심사", "저자와 심사위원의 신원을 서로 공개하지 않습니다."],
  ["03", "판정·수정", "모든 의견과 상태 변경을 이력으로 보존합니다."],
  ["04", "게재·발행", "최종원고를 발행호에 배정하고 논문을 공개합니다."],
];

const principles = [
  {
    number: "01",
    eyebrow: "DOUBLE-BLIND REVIEW",
    title: "이중맹검 심사",
    description: "심사위원에게는 논문번호, 제목, 초록, 익명 원고만 제공됩니다.",
  },
  {
    number: "02",
    eyebrow: "TRACEABLE WORKFLOW",
    title: "기록이 남는 절차",
    description: "접수부터 발행까지 누가 언제 어떤 결정을 내렸는지 보존합니다.",
  },
  {
    number: "03",
    eyebrow: "ROLE-BASED ACCESS",
    title: "역할별 권한관리",
    description: "저자·심사위원·편집위원·관리자에게 필요한 정보만 제공합니다.",
  },
];

export function PublicHome({ onEnter }: { onEnter: () => void }) {
  return (
    <>
      <section className="journal-hero" id="journal-home">
        <div className="shell journal-hero-grid">
          <div className="journal-hero-copy">
            <p className="eyebrow"><span /> KOREAN JOURNAL OF DIGITAL HEALTH &amp; FITNESS</p>
            <h1>
              건강체력 연구가<br />
              <em>학술 기록</em>이 되는 곳.
            </h1>
            <p className="journal-hero-description">
              한국 디지털 건강체력학회지의 논문투고, 이중맹검 심사,<br className="desktop-break" />
              편집판정과 발행을 하나의 안전한 흐름으로 연결합니다.
            </p>
            <div className="hero-actions">
              <button className="button button-primary" type="button" onClick={onEnter}>
                논문투고·심사 시작 <span aria-hidden="true">→</span>
              </button>
              <a className="text-link" href="#journal-workflow">운영 절차 보기 <span aria-hidden="true">↘</span></a>
            </div>
          </div>

          <div className="editorial-map" aria-label="논문 처리 단계 요약">
            <div className="map-head">
              <div><span>KJDHF / EDITORIAL FLOW</span><strong>온라인 투고·심사</strong></div>
              <span className="map-status"><i /> SECURE</span>
            </div>
            <div className="editorial-map-body">
              <div className="editorial-ring ring-one"><span>SUBMIT</span></div>
              <div className="editorial-ring ring-two"><span>REVIEW</span></div>
              <div className="editorial-ring ring-three"><span>PUBLISH</span></div>
              <div className="editorial-core"><small>KJDHF</small><strong>DB</strong><span>01—14</span></div>
              <div className="map-note note-one"><i /> 원고·저자 분리</div>
              <div className="map-note note-two"><i /> 2인 심사</div>
              <div className="map-note note-three"><i /> 변경이력 보존</div>
            </div>
            <div className="map-footer">
              <div><span>01</span><p>SUBMIT<br /><b>투고</b></p></div>
              <div><span>02</span><p>REVIEW<br /><b>심사</b></p></div>
              <div><span>03</span><p>PUBLISH<br /><b>발행</b></p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="journal-intro section" id="journal-about">
        <div className="shell intro-grid">
          <div className="section-index"><span>01</span><p>ABOUT THE JOURNAL</p></div>
          <div className="intro-content">
            <p className="intro-kicker">창간과 초기 운영에 꼭 필요한 기능에 집중했습니다.</p>
            <h2>안정적인 기록, 명확한 권한,<br /><span>공정한 심사 흐름.</span></h2>
            <div className="intro-bottom">
              <p>
                이 시스템은 향후 JAMS 이전 전까지 실제 학술지 운영에 사용할 수 있도록 설계했습니다.
                개인정보와 심사정보를 분리하고, 각 단계의 책임과 기록을 명확히 남깁니다.
              </p>
              <button className="inline-action" type="button" onClick={onEnter}>내 업무화면 열기 <span>↗</span></button>
            </div>
          </div>
        </div>
      </section>

      <section className="journal-principles section" id="journal-policy">
        <div className="shell">
          <div className="section-heading">
            <div className="section-index light-index"><span>02</span><p>CORE PRINCIPLES</p></div>
            <div><p className="heading-overline">Integrity by design</p><h2>운영의 기준을<br />시스템에 담았습니다.</h2></div>
          </div>
          <div className="principle-grid">
            {principles.map((item) => (
              <article className="principle-card" key={item.number}>
                <div><span>{item.number}</span><small>{item.eyebrow}</small></div>
                <div className={`principle-graphic principle-${item.number}`} aria-hidden="true"><i /><i /><b /></div>
                <h3>{item.title}</h3><p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="journal-workflow section" id="journal-workflow">
        <div className="shell process-grid">
          <div className="process-sticky">
            <div className="section-index"><span>03</span><p>EDITORIAL WORKFLOW</p></div>
            <h2>투고에서<br />발행까지</h2>
            <p>모든 단계는 역할과 권한에 따라 이어집니다.</p>
          </div>
          <ol className="process-list">
            {workflow.map(([number, title, description]) => (
              <li key={number}><span>{number}</span><div><small>KJDHF WORKFLOW</small><h3>{title}</h3><p>{description}</p></div><i aria-hidden="true">↘</i></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="system-cta">
        <div className="shell system-cta-inner">
          <p>ONLINE SUBMISSION &amp; REVIEW</p>
          <h2>투고 또는 심사를<br />시작하시겠습니까?</h2>
          <button type="button" onClick={onEnter}>시스템 로그인 <span aria-hidden="true">↗</span></button>
          <small>신규 사용자는 로그인 화면에서 회원가입할 수 있습니다.</small>
        </div>
      </section>
    </>
  );
}
