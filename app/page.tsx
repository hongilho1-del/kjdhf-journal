const researchAreas = [
  {
    number: "01",
    eyebrow: "LIFESPAN FITNESS",
    title: "생애주기 건강체력",
    description:
      "아동부터 노년까지, 연령과 생활환경에 따라 달라지는 체력의 기준과 변화를 연구합니다.",
    tags: ["체력 기준", "성장·노화", "생활습관"],
  },
  {
    number: "02",
    eyebrow: "MOVEMENT SCIENCE",
    title: "움직임과 운동처방",
    description:
      "움직임을 정밀하게 관찰하고 개인의 상태와 목적에 맞는 안전한 운동 전략을 설계합니다.",
    tags: ["동작 분석", "운동처방", "회복"],
  },
  {
    number: "03",
    eyebrow: "FIELD EVIDENCE",
    title: "현장 기반 데이터",
    description:
      "학교·지역·조직의 실제 현장에서 데이터를 수집하고, 지속 가능한 건강 변화를 검증합니다.",
    tags: ["현장 연구", "프로그램 평가", "공동연구"],
  },
];

const notices = [
  {
    date: "안내",
    title: "연구 참여 및 공동연구 문의",
    text: "건강체력 측정, 운동 프로그램, 현장 연구에 관한 협업 제안을 기다립니다.",
  },
  {
    date: "준비 중",
    title: "건강체력 측정 프로그램",
    text: "프로그램 일정과 참여 방법을 곧 안내할 예정입니다.",
  },
  {
    date: "업데이트",
    title: "연구자료 아카이브",
    text: "연구보고서와 건강체력 자료를 순차적으로 공개합니다.",
  },
];

const process = [
  ["MEASURE", "정확히 측정하고", "몸과 생활환경을 함께 관찰합니다."],
  ["INTERPRET", "맥락을 해석하고", "숫자 뒤에 있는 원인과 가능성을 찾습니다."],
  ["DESIGN", "변화를 설계하고", "실천할 수 있는 운동과 환경을 제안합니다."],
  ["VERIFY", "현장에서 검증합니다", "지속 가능한 변화를 다시 데이터로 확인합니다."],
];

export default function Home() {
  return (
    <main>
      <div className="top-line">
        <div className="shell top-line-inner">
          <p>Evidence · Movement · Well-being</p>
          <a href="#contact">공동연구 문의 <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <header className="site-header">
        <div className="shell nav-wrap">
          <a className="brand" href="#top" aria-label="건강체력연구소 홈">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span className="brand-copy">
              <strong>건강체력연구소</strong>
              <small>HEALTH &amp; FITNESS LAB</small>
            </span>
          </a>

          <nav className="desktop-nav" aria-label="주요 메뉴">
            <a href="#about">연구소 소개</a>
            <a href="#research">연구분야</a>
            <a href="#process">연구방법</a>
            <a href="#news">소식·자료</a>
          </nav>

          <a className="nav-cta" href="#contact">
            함께 연구하기 <span aria-hidden="true">↗</span>
          </a>

          <details className="mobile-menu">
            <summary aria-label="메뉴 열기"><span /><span /></summary>
            <nav aria-label="모바일 메뉴">
              <a href="#about">연구소 소개</a>
              <a href="#research">연구분야</a>
              <a href="#process">연구방법</a>
              <a href="#news">소식·자료</a>
              <a href="#contact">공동연구 문의</a>
            </nav>
          </details>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span /> HEALTH &amp; FITNESS RESEARCH LAB</p>
            <h1>
              몸의 데이터를<br />
              <em>일상의 변화</em>로.
            </h1>
            <p className="hero-description">
              우리는 건강체력을 과학적으로 측정하고 해석해,<br className="desktop-break" />
              누구나 오래 지속할 수 있는 움직임을 설계합니다.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#research">
                연구분야 보기 <span aria-hidden="true">→</span>
              </a>
              <a className="text-link" href="#about">연구소 이야기 <span aria-hidden="true">↘</span></a>
            </div>
          </div>

          <div className="fitness-map" aria-label="건강체력의 구성 요소를 표현한 시각 자료">
            <div className="map-head">
              <div>
                <span>HFL / FITNESS MAP</span>
                <strong>통합 건강체력</strong>
              </div>
              <span className="map-status"><i /> RESEARCH</span>
            </div>
            <div className="map-body">
              <div className="orbit orbit-one"><span>MOVE</span></div>
              <div className="orbit orbit-two"><span>REST</span></div>
              <div className="orbit orbit-three"><span>LIVE</span></div>
              <div className="core">
                <small>HUMAN</small>
                <strong>FIT</strong>
                <span>01—04</span>
              </div>
              <span className="map-axis axis-x" />
              <span className="map-axis axis-y" />
              <div className="map-note note-one"><i /> 심폐체력</div>
              <div className="map-note note-two"><i /> 근기능</div>
              <div className="map-note note-three"><i /> 움직임</div>
            </div>
            <div className="map-footer">
              <div><span>01</span><p>MEASURE<br /><b>측정</b></p></div>
              <div><span>02</span><p>ANALYZE<br /><b>분석</b></p></div>
              <div><span>03</span><p>DESIGN<br /><b>설계</b></p></div>
            </div>
          </div>
        </div>
        <div className="shell hero-foot">
          <span>SCROLL TO EXPLORE</span>
          <div className="hero-line" />
          <p>MEASURE BETTER · MOVE BETTER · LIVE BETTER</p>
        </div>
      </section>

      <section className="intro section" id="about">
        <div className="shell intro-grid">
          <div className="section-index">
            <span>01</span>
            <p>ABOUT THE LAB</p>
          </div>
          <div className="intro-content">
            <p className="intro-kicker">건강한 삶은 좋은 숫자 하나로 설명되지 않습니다.</p>
            <h2>
              사람을 보고, 환경을 읽고,<br />
              <span>변화를 함께 만듭니다.</span>
            </h2>
            <div className="intro-bottom">
              <p>
                건강체력연구소는 측정실의 정밀함과 생활 현장의 현실성을 연결합니다.
                체력, 움직임, 회복, 생활환경을 함께 살펴 개인과 공동체에 실제로 작동하는
                해답을 찾습니다.
              </p>
              <a href="#process">연구 접근법 <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section className="research section" id="research">
        <div className="shell">
          <div className="section-heading">
            <div className="section-index light-index">
              <span>02</span>
              <p>RESEARCH AREAS</p>
            </div>
            <div>
              <p className="heading-overline">Research for everyday strength</p>
              <h2>더 잘 움직이는 삶을 위한<br />세 가지 연구축</h2>
            </div>
          </div>

          <div className="research-list">
            {researchAreas.map((area) => (
              <article className="research-card" key={area.number}>
                <div className="card-top">
                  <span>{area.number}</span>
                  <small>{area.eyebrow}</small>
                </div>
                <div className={`card-graphic graphic-${area.number}`} aria-hidden="true">
                  <i /><i /><i /><b />
                </div>
                <div className="card-copy">
                  <h3>{area.title}</h3>
                  <p>{area.description}</p>
                  <ul>
                    {area.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="process section" id="process">
        <div className="shell process-grid">
          <div className="process-sticky">
            <div className="section-index">
              <span>03</span>
              <p>HOW WE WORK</p>
            </div>
            <h2>데이터가<br />실천이 되기까지</h2>
            <p>연구의 시작과 끝은 언제나 사람의 일상입니다.</p>
          </div>

          <ol className="process-list">
            {process.map((item, index) => (
              <li key={item[0]}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{item[0]}</small>
                  <h3>{item[1]}</h3>
                  <p>{item[2]}</p>
                </div>
                <i aria-hidden="true">↘</i>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="news section" id="news">
        <div className="shell">
          <div className="news-heading">
            <div className="section-index">
              <span>04</span>
              <p>NEWS &amp; RESOURCES</p>
            </div>
            <div>
              <p>연구소의 새로운 소식과 자료를 전합니다.</p>
              <h2>연구소 소식</h2>
            </div>
            <a href="#news-list" aria-label="소식 전체보기">전체보기 <span>↗</span></a>
          </div>

          <div className="news-grid" id="news-list">
            <article className="featured-news">
              <div className="featured-label"><span>HFL NOTICE</span><i>01</i></div>
              <div className="feature-orbit" aria-hidden="true"><i /><i /><b>HFL</b></div>
              <div>
                <p>OPEN COLLABORATION</p>
                <h3>몸과 움직임을 연구하는<br />좋은 질문을 기다립니다.</h3>
                <a href="#contact">협력 문의하기 <span aria-hidden="true">→</span></a>
              </div>
            </article>

            <div className="notice-list">
              {notices.map((notice, index) => (
                <article key={notice.title}>
                  <span>{notice.date}</span>
                  <div>
                    <small>NOTICE {String(index + 1).padStart(2, "0")}</small>
                    <h3>{notice.title}</h3>
                    <p>{notice.text}</p>
                  </div>
                  <i aria-hidden="true">↗</i>
                </article>
              ))}
            </div>
          </div>

          <div className="quick-links">
            <a href="#research">
              <small>RESEARCH</small>
              <strong>연구분야 살펴보기</strong>
              <span>↗</span>
            </a>
            <a href="#process">
              <small>METHOD</small>
              <strong>연구방법 알아보기</strong>
              <span>↗</span>
            </a>
            <a href="#contact">
              <small>TOGETHER</small>
              <strong>공동연구 제안하기</strong>
              <span>↗</span>
            </a>
          </div>
        </div>
      </section>

      <section className="contact" id="contact">
        <div className="shell contact-inner">
          <p>LET&apos;S MOVE FORWARD</p>
          <h2>더 건강한 움직임을<br />함께 연구해요.</h2>
          <a href="mailto:hello@healthfitnesslab.kr">
            hello@healthfitnesslab.kr <span aria-hidden="true">↗</span>
          </a>
          <p className="contact-note">※ 위 이메일은 사이트 시안용 예시입니다. 실제 연구소 연락처로 교체해 주세요.</p>
        </div>
      </section>

      <footer>
        <div className="shell footer-grid">
          <a className="brand footer-brand" href="#top" aria-label="건강체력연구소 홈">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span className="brand-copy">
              <strong>건강체력연구소</strong>
              <small>HEALTH &amp; FITNESS LAB</small>
            </span>
          </a>
          <p>과학적 근거를 일상의 건강한 움직임으로 연결합니다.</p>
          <div className="footer-meta">
            <span>© 2026 HEALTH &amp; FITNESS LAB</span>
            <a href="#top">BACK TO TOP ↑</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
