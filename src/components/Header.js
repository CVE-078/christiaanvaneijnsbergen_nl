import React from 'react'
import Navigation from './Navigation'
import './Header.scss'

const Header = (props) => {
    return (
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
                        <Navigation />
                    </div>

                    <div className="header__hamburger">
                        <i className="fas fa-fw fa-2x fa-bars"></i>
                    </div>
                </div>

            </div>
        </header>
    )
}

export default Header