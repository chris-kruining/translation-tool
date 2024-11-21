import { A } from "@solidjs/router";
import LandingImage from '../../assets/landing.svg'
import css from "./test.module.css";


export default function Index() {
  return (
    <main class={css.main}>
      <LandingImage />

      <h1>Hi, welcome!</h1>
      <b>Lets get started</b>

      <div class={css.primary}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div class={css.secondary}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <ul>
        <li><A href="/edit">Start editing</A></li>
        {/* <li><A href="/experimental">Try new features</A></li> */}
        <li><A href="/instructions">Read the instructions</A></li>
        <li><A href="/about">About this app</A></li>
      </ul>
    </main>
  );
}
