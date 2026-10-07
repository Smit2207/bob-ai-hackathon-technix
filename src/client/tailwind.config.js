/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#f0f5f9', 100:'#dbe4ed', 200:'#b8c9db', 300:'#88a3c2', 400:'#5d7ca0', 500:'#3d5e83', 600:'#2f4a6b', 700:'#273b57', 800:'#22314a', 900:'#1d2a3e' },
        status: { green:'#1a7f37', amber:'#b8710e', red:'#b42318', blue:'#1d4ed8' }
      },
      fontFamily: { sans:['Inter','system-ui','sans-serif'], mono:['JetBrains Mono','monospace'] },
      spacing: { '18':'4.5rem', '22':'5.5rem' },
      borderRadius: { 'xl':'0.5rem', '2xl':'0.75rem' },
      boxShadow: { 'card':'0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)', 'drawer':'0 -4px 12px rgba(0,0,0,0.06)' },
      animation: { 'fade-in':'fadeIn 200ms ease-out', 'slide-up':'slideUp 250ms ease-out', 'slide-down':'slideDown 200ms ease-out', 'accordion':'accordion 220ms ease-out' },
      keyframes: { fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}}, slideUp:{'0%':{opacity:'0',transform:'translateY(6px)'},'100%':{opacity:'1',transform:'translateY(0)'}}, slideDown:{'0%':{opacity:'0',transform:'translateY(-6px)'},'100%':{opacity:'1',transform:'translateY(0)'}}, accordion:{'0%':{height:'0',opacity:'0'},'100%':{height:'var(--accordion-height)',opacity:'1'}} }
    }
  },
  plugins: [],
}