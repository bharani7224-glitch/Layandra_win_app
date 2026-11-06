'use client';

import dynamic from 'next/dynamic';

const Lanyard = dynamic(() => import('@/components/Lanyard'), {
  ssr: false,
});

const Galaxy = dynamic(() => import('@/components/Galaxy'), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      {/* Galaxy Background */}
      <div className="galaxy-bg-wrapper" aria-hidden="true">
        <Galaxy
          mouseInteraction={true}
          glowIntensity={0.35}
          starSpeed={0.5}
          density={1}
          hueShift={240}
          transparent={true}
        />
      </div>

      {/* Hanging ID Card Badge in Top-Right Corner */}
      <div className="lanyard-badge-container" aria-label="Interactive Hanging ID Badge">
        <Lanyard
          frontImage="/id-card-photo.png"
          imageFit="cover"
          orientation="portrait"
          cardColor="#1a0b2e"
          strapColor="#500071"
          metal="silver"
          finish="glossy"
          interactive={true}
          gravity={1}
          breeze={0.25}
          elasticity={0.7}
          damping={1.985}
          size={0.65}
          strapLength={0.4}
        />
      </div>

      {/* Website Main Content */}
      <div className="website">
        {/* Navbar */}
        <nav className="navbar">
          <div className="logo">
            NEX<span>ORA.DEV</span>
          </div>

          <div className="nav-links">
            <a href="#home" className="active">Home</a>
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#projects">Projects</a>
            <a href="#contact">Contact</a>
          </div>

          <button className="nav-button" type="button">
            Get Started <span>↗</span>
          </button>
        </nav>

        {/* Hero Section */}
        <main className="hero" id="home">
          <div className="hero-content">
            <span className="hero-tag">
              ✦ CREATIVE DIGITAL AGENCY
            </span>

            <h1>
              Build Your
              <span> Digital Future.</span>
            </h1>

            <p>
              We create modern digital experiences that help
              businesses grow, innovate, and stand out.
            </p>

            <div className="hero-buttons">
              <button className="primary-btn" type="button">
                Explore Our Work ↗
              </button>

              <button className="secondary-btn" type="button">
                Learn More
              </button>
            </div>

            <div className="hero-stats">
              <div>
                <h3>50+</h3>
                <span>Projects</span>
              </div>

              <div>
                <h3>30+</h3>
                <span>Clients</span>
              </div>

              <div>
                <h3>5+</h3>
                <span>Years Experience</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-circle">
              <span>N</span>
            </div>
            <div className="floating-card">
              ✦ Innovation Starts Here
            </div>
          </div>
        </main>

        {/* About Section */}
        <section className="about-section" id="about">
          <div className="about-left">
            <span className="section-tag">✦ ABOUT NEXORA</span>

            <h2>
              We Turn Ideas Into
              <span> Digital Reality.</span>
            </h2>

            <p>
              We are a creative digital agency focused on building
              meaningful digital experiences. We combine creativity,
              technology, and strategy to help businesses grow.
            </p>

            <button className="primary-btn" type="button">
              Discover More ↗
            </button>
          </div>

          <div className="about-right">
            <div className="about-card">
              <span className="about-number">01</span>
              <h3>Creative Thinking</h3>
              <p>Fresh ideas and innovative solutions for every challenge.</p>
            </div>

            <div className="about-card">
              <span className="about-number">02</span>
              <h3>Modern Technology</h3>
              <p>Building reliable and scalable digital experiences.</p>
            </div>

            <div className="about-card">
              <span className="about-number">03</span>
              <h3>Business Growth</h3>
              <p>Turning technology into measurable business value.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
