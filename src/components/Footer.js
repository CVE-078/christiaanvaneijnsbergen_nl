import React from 'react'
import './Footer.scss'

function Footer() {
    return (
        <footer className="footer">
            <div className="container">

                <div className="footer__wrapper">

                    <div className="footer__bottom">

                        <div className="footer__socials">
                            <a href="https://www.linkedin.com/in/christiaan-van-eijnsbergen/" rel="noreferrer" className="footer__link">
                                <i className="fab fa-fw fa-linkedin-in"></i>
                            </a>

                            <a href="https://github.com/CVE-078" rel="noreferrer" className="footer__link">
                                <i className="fab fa-fw fa-github"></i>
                            </a>
                        </div>

                    </div>

                </div>

            </div>
        </footer>
    )
}

export default Footer
