import React from 'react';
import { Zap, ArrowRight, Sparkles, Send, Check } from 'lucide-react';
import './buttons.css';

/**
 * 1. Floating Dots CTA (Floating particles, radial backdrops, arrow dash animation)
 */
export function FloatingDotsButton({
  children = 'Sign Up',
  icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <button
      type={type}
      className={`btn-floating-dots ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <div className="points_wrapper" aria-hidden="true">
        <i className="point" />
        <i className="point" />
        <i className="point" />
        <i className="point" />
        <i className="point" />
        <i className="point" />
        <i className="point" />
        <i className="point" />
        <i className="point" />
        <i className="point" />
      </div>
      <span className="inner">
        {children}
        {icon !== undefined ? icon : (
          <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        )}
      </span>
    </button>
  );
}

/**
 * 2. Launch Button (Amber/Electric 3D button with radiant blur backdrop)
 */
export function LaunchButton({
  children = 'Initialize Launch',
  icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <button
      type={type}
      className={`btn-launch-group ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <div className="btn-launch-blur" aria-hidden="true" />
      <div className="btn-launch-surface">
        <span>{children}</span>
        {icon !== undefined ? icon : <Zap className="btn-launch-icon" size={18} />}
      </div>
    </button>
  );
}

/**
 * 3. Gradient Beam CTA (Rotating conic light beam border & animated dots)
 */
export function GradientBeamButton({
  children = 'Start Building',
  icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <button
      type={type}
      className={`btn-gradient-beam ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <div className="btn-beam-spin-container" aria-hidden="true">
        <div className="btn-beam-spin" />
        <div className="btn-beam-mask" />
      </div>
      <div className="btn-beam-inner">
        <div className="btn-beam-dots" aria-hidden="true" />
        <div className="btn-beam-glow" aria-hidden="true" />
      </div>
      <span className="btn-beam-content">
        {children}
        {icon !== undefined ? icon : <ArrowRight className="btn-beam-icon" size={16} />}
      </span>
    </button>
  );
}

/**
 * 4. Spinning Border Button (3D pill surface with spinning hover light beam)
 */
export function SpinningBorderButton({
  children = 'Request Demo',
  icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <button
      type={type}
      className={`btn-spinning-border ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <span className="btn-spin-beam" aria-hidden="true" />
      <span className="btn-spin-static" aria-hidden="true" />
      <span className="btn-spin-surface">
        <span>{children}</span>
        {icon !== undefined ? icon : <ArrowRight size={14} className="btn-spin-icon" />}
      </span>
    </button>
  );
}

/**
 * 5. Gradient CTA (Tactile layered gradient with slide sweep)
 */
export function GradientCtaButton({
  children = 'Start Free Pilot',
  icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <button
      type={type}
      className={`btn-gradient-cta ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <div className="btn-gradient-cta-sweep" aria-hidden="true" />
      <span className="btn-gradient-cta-content">
        {children}
        {icon !== undefined ? icon : <Send size={16} />}
      </span>
    </button>
  );
}

/**
 * 6. Lumen CTA & Ghost (Midnight gradient pill with glowing ring indicator)
 */
export function LumenButton({
  children = 'Get Started',
  variant = 'primary', // 'primary' or 'ghost'
  ring = true,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  const isGhost = variant === 'ghost' || variant === 'lumen-cta-ghost';
  return (
    <button
      type={type}
      className={`lumen-cta__button ${isGhost ? 'lumen-cta__button--ghost' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <span>{children}</span>
      {ring && <i className="lumen-cta__ring" aria-hidden="true" />}
    </button>
  );
}

/**
 * 7. Glassmorphism CTA (Rotating shimmer beam with dark glass backdrop)
 */
export function GlassmorphismButton({
  children = 'Generate Site',
  icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <button
      type={type}
      className={`btn-glassmorphism ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <div className="btn-glass-shimmer-wrap" aria-hidden="true">
        <div className="btn-glass-shimmer" />
      </div>
      <div className="btn-glass-blur-bg" aria-hidden="true" />
      <div className="btn-glass-content">
        <span>{children}</span>
        {icon !== undefined ? icon : (
          <span className="btn-glass-badge">
            <Sparkles size={14} />
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * 8. Dot Border Button (Dynamic corner dots & dotted lines on hover)
 */
export function DotBorderButton({
  children = 'Start Creating',
  icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <div className={`btn-dot-border-wrapper ${className}`} style={style}>
      <div className="line horizontal top" aria-hidden="true" />
      <div className="line vertical right" aria-hidden="true" />
      <div className="line horizontal bottom" aria-hidden="true" />
      <div className="line vertical left" aria-hidden="true" />
      <div className="dot top left" aria-hidden="true" />
      <div className="dot top right" aria-hidden="true" />
      <div className="dot bottom right" aria-hidden="true" />
      <div className="dot bottom left" aria-hidden="true" />
      <button
        type={type}
        className="btn-dot-border-core"
        onClick={onClick}
        disabled={disabled}
      >
        <span>{children}</span>
        {icon}
      </button>
    </div>
  );
}

/**
 * 9. Sliding Text CTA (Sliding text clone with blur reveal)
 */
export function SlidingTextButton({
  children = 'Download App',
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <button
      type={type}
      className={`btn-sliding-text ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <span className="btn-sliding-text-main">{children}</span>
      <span className="btn-sliding-text-clone" aria-hidden="true">{children}</span>
      <span className="btn-sliding-underline" aria-hidden="true" />
      <span className="btn-sliding-gradient" aria-hidden="true" />
    </button>
  );
}

/**
 * 10. Generate Button (Tactile button with flickering icon & letter ripple)
 */
export function GenerateButton({
  children = 'Generate',
  icon,
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  const text = typeof children === 'string' ? children : 'Generate';
  return (
    <div className={`btn-generate-wrapper ${className}`} style={style}>
      <button
        type={type}
        className="btn-generate-core"
        onClick={onClick}
        disabled={disabled}
      >
        {icon !== undefined ? icon : <Sparkles className="btn-generate-svg" size={18} />}
        <div className="btn-generate-txt">
          <span className="txt-1">
            {text.split('').map((char, i) => (
              <span key={i} className="btn-letter" style={{ animationDelay: `${i * 0.08}s` }}>
                {char === ' ' ? '\u00a0' : char}
              </span>
            ))}
          </span>
        </div>
      </button>
    </div>
  );
}

/**
 * 11. Dark Glass Button / Section Button (Glass pill with rotating light orbit)
 */
export function DarkGlassButton({
  children = 'Sign up',
  type = 'button',
  onClick,
  disabled = false,
  className = '',
  style
}) {
  return (
    <button
      type={type}
      className={`section-button ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      <span className="section-button__title">{children}</span>
      <span className="section-button__circle" aria-hidden="true" />
    </button>
  );
}

/**
 * Master Polymorphic Component: RectangleButtons
 */
export function RectangleButtons({
  variant = 'floating-dots-cta',
  children,
  ...props
}) {
  switch (variant) {
    case 'launch-button':
      return <LaunchButton {...props}>{children}</LaunchButton>;
    case 'gradient-beam-cta':
      return <GradientBeamButton {...props}>{children}</GradientBeamButton>;
    case 'spinning-border-button':
      return <SpinningBorderButton {...props}>{children}</SpinningBorderButton>;
    case 'gradient-cta':
      return <GradientCtaButton {...props}>{children}</GradientCtaButton>;
    case 'lumen-cta':
      return <LumenButton {...props} variant="primary">{children}</LumenButton>;
    case 'lumen-cta-ghost':
      return <LumenButton {...props} variant="ghost">{children}</LumenButton>;
    case 'glassmorphism-cta':
      return <GlassmorphismButton {...props}>{children}</GlassmorphismButton>;
    case 'dot-border-button':
      return <DotBorderButton {...props}>{children}</DotBorderButton>;
    case 'sliding-text-cta':
      return <SlidingTextButton {...props}>{children}</SlidingTextButton>;
    case 'generate-button':
      return <GenerateButton {...props}>{children}</GenerateButton>;
    case 'dark-pill':
    case 'dark-glass-button':
      return <DarkGlassButton {...props}>{children}</DarkGlassButton>;
    case 'floating-dots-cta':
    default:
      return <FloatingDotsButton {...props}>{children}</FloatingDotsButton>;
  }
}

export default RectangleButtons;
