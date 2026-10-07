export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal show" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modalbox">
        <div className="topbar"><h2>{title}</h2><button className="btn secondary" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  )
}
