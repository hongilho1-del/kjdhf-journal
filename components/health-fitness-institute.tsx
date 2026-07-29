"use client";

export function HealthFitnessInstitute({ onBackHome }: { onBackHome: () => void }) {
  return (
    <section className="institute-page">
      <div className="institute-hero">
        <div className="shell institute-hero-inner">
          <div>
            <p>KONGJU NATIONAL UNIVERSITY</p>
            <h1>건강체력연구소</h1>
            <span>건강과 체력에 관한 교육·연구를 연결하는 국립공주대학교 연구기관</span>
          </div>
          <div className="institute-monogram" aria-hidden="true"><span>HFI</span><i /><i /></div>
        </div>
      </div>
      <div className="shell institute-content">
        <nav aria-label="현재 위치"><button type="button" onClick={onBackHome}>학회지 홈</button><span>›</span><strong>건강체력연구소</strong></nav>
        <div className="institute-intro">
          <div><small>HEALTH &amp; FITNESS INSTITUTE</small><h2>연구소 홈페이지를<br />준비하고 있습니다.</h2></div>
          <div><p>건강체력연구소의 소개, 연구사업, 학술활동과 공지사항을 제공할 별도 홈페이지 연결 영역입니다.</p><p>공식 사이트 주소가 확정되면 상단의 <b>건강체력연구소</b> 메뉴에서 바로 이동하도록 연결합니다.</p></div>
        </div>
        <div className="institute-cards">
          <article><span>01</span><strong>연구소 소개</strong><p>설립 목적과 조직, 주요 연구분야를 안내할 예정입니다.</p></article>
          <article><span>02</span><strong>연구·학술활동</strong><p>연구사업, 세미나와 학술행사 소식을 제공할 예정입니다.</p></article>
          <article><span>03</span><strong>자료·공지</strong><p>연구자료와 연구소 공지사항을 확인할 수 있도록 준비합니다.</p></article>
        </div>
        <button className="institute-back" type="button" onClick={onBackHome}>한국 디지털 건강체력학회지로 돌아가기 <span>→</span></button>
      </div>
    </section>
  );
}
