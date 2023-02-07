import React, { useEffect, useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import About from './components/About'
import Jobs from './components/Jobs'
import Projects from './components/Projects'
import Footer from './components/Footer'

const App = () => {
  const [open, setOpen] = useState(false);

  const showJobs = true;
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

        {showJobs ? <Jobs /> : null}
        {showProjects ? <Projects /> : null}
      </main>

      <Footer />
    </>
  )
}

export default App
