import React from 'react'
import './Navigation.scss'

const Navigation = () => {
    return (
        <nav className="navigation">
            <ul className="navigation__list">

                <li className="navigation__item">
                    <a href="/#about" className="navigation__link link link--anchor">about</a>
                </li>

                <li className="navigation__item">
                    <a href="/#jobs" className="navigation__link link link--anchor">jobs</a>
                </li>

                <li className="navigation__item">
                    <a href="/#projects" className="navigation__link link link--anchor">projects</a>
                </li>

                <li className="navigation__item">
                    <a href="/#contact" className="navigation__button link link--anchor">say hello!</a>
                </li>

            </ul>
        </nav>
    )
}

export default Navigation
