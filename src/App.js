import React, { useEffect, useState } from 'react'
import Header from './components/Header/Header'
import Footer from './components/Footer/Footer'

import Hero from './components/Hero/Hero'
import About from './components/About/About'
import Experience from './components/Experience/Experience'
import Projects from './components/Projects/Projects'

const App = () => {
  const [open, setOpen] = useState(false);

  const showExperience = true;
  const showProjects = false;

  const initSmoothScroll = () => {
    const anchors = document.querySelectorAll('.link--anchor');

    anchors.forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const elementId = e.target.hash;
        const element = document.querySelector(elementId);

        e.preventDefault();

        element.scrollIntoView({
          block: 'start',
          behavior: 'smooth'
        });
      })
    })
  }

  useEffect(() => {
    initSmoothScroll();
  }, []);

  return (
    <>
      <Header open={open} setOpen={setOpen} />
      <Hero />

      <main className="main">
        <About />

        {showExperience ? <Experience /> : null}
        {showProjects ? <Projects /> : null}
      </main>

      <Footer />
    </>
  )
}

export default App
