import React from 'react'
import Navigation from './../Navigation/Navigation'
import './Header.scss'

const Header = ({ open, setOpen }) => (
    <header className="header header--fixed">
        <div className="container">

            <div className="header__wrapper fade-in">
                <div className="header__logo">
                    <a href="/#top" className="header__link link link--anchor">
                        <span className="header__text">CVE</span>
                        <span className="header__box"></span>
                    </a>
                </div>

                <div className="header__navigation">
                    <Navigation open={open} setOpen={setOpen} />
                </div>

                <div className="header__hamburger" onClick={() => setOpen(!open)}>
                    <i className="fas fa-fw fa-2x fa-bars"></i>
                </div>
            </div>

        </div>
    </header>
)

export default Header