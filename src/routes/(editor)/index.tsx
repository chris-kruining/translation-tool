import { A } from "@solidjs/router";
import LandingImage from '../../assets/landing.svg'
import css from "./index.module.css";


export default function Index() {
  return (
    <main class={css.main}>
      <LandingImage />

      <h1>Hi, welcome!</h1>
      <b>Lets get started</b>

      <ul>
        <li><A href="/edit">Start editing</A></li>
        {/* <li><A href="/experimental">Try new features</A></li> */}
        <li><A href="/instructions">Read the instructions</A></li>
        <li><A href="/about">About this app</A></li>
      </ul>
    </main>
  );
}
