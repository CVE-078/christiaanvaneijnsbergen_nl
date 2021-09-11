import React from 'react'
import { socials } from '../lib/data'
import './Footer.scss'

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container">
                <span id="contact" className="is-visually-hidden" style={{ top: '-80px' }}>&nbsp;</span>

                <div className="footer__wrapper fade-in">

                    <div className="footer__top">
                        <h2 className="footer__title">get in touch</h2>

                        <div className="footer__text">
                            <p>
                                fancy a collaboration?
                                have a question you really need to ask?
                                or perhaps just want to say hi?
                            </p>

                            <p>
                                feel free to shoot me a message on&nbsp;
                                <a href="https://www.linkedin.com/in/christiaan-van-eijnsbergen/" rel="noreferrer" target="_blank" className="link link--external">LinkedIn</a>
                                &nbsp;or by sending me a&nbsp;
                                <a href="mailto:christiaanvaneijnsbergen@gmail.com" rel="noreferrer" className="link link--external">mail</a>.
                            </p>
                        </div>
                    </div>

                    <div className="footer__bottom">

                        <div className="footer__socials">

                            {socials && socials.map((item, index) => (
                                <a key={index} href={item.url} rel="noreferrer" target="_blank" className="footer__link">
                                    <i className={item.icon}></i>
                                </a>
                            ))}

                        </div>

                    </div>

                </div>

            </div>
        </footer>
    )
}

export default Footer
