import React from 'react';
import { ExternalLink } from 'lucide-react';

const GoogleReviews = () => {
    const googleBusinessUrl = "https://www.google.com/maps/place/G+Tec+Inform%C3%A1tica+-+Assist%C3%AAncia+t%C3%A9cnica+de+notebooks,+computadores+e+impressoras+em+Manaus/@-3.0580251,-59.9572281,17z/data=!3m1!4b1!4m6!3m5!1s0x926c1b9adda83c8d:0x1c2268279d2a2b5e!8m2!3d-3.0580251!4d-59.9572281!16s%2Fg%2F11j8ynb6qy?entry=ttu&g_ep=EgoyMDI1MDExNC4wIKXMDSoASAFQAw%3D%3D";

    return (
        <section className="container" style={{ padding: '2rem 20px', marginBottom: '4rem' }}>
            <div style={{
                background: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background Decoration */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '150px',
                    height: '150px',
                    background: 'var(--color-accent)',
                    opacity: 0.1,
                    borderRadius: '50%',
                    filter: 'blur(50px)'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: '#4285F4' }}>G</span>
                            <span style={{ color: '#DB4437' }}>o</span>
                            <span style={{ color: '#F4B400' }}>o</span>
                            <span style={{ color: '#4285F4' }}>g</span>
                            <span style={{ color: '#0F9D58' }}>l</span>
                            <span style={{ color: '#DB4437' }}>e</span>
                            <span style={{ color: 'white', marginLeft: '5px' }}>Reviews</span>
                        </h2>
                        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                            Veja nossa localização e avaliações
                        </p>
                    </div>

                    <a
                        href={googleBusinessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{
                            background: 'white',
                            color: 'black',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 'bold'
                        }}
                    >
                        Avaliar no Google <ExternalLink size={16} />
                    </a>
                </div>

                {/* Google Maps Embed */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <iframe
                        src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3984.1369009000614!2d-59.9572281!3d-3.0580251!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x926c1b9adda83c8d%3A0x1c2268279d2a2b5e!2sG%20Tec%20Inform%C3%A1tica%20-%20Assist%C3%AAncia%20t%C3%A9cnica%20de%20notebooks%2C%20computadores%20e%20impressoras%20em%20Manaus!5e0!3m2!1spt-BR!2sbr!4v1768677948987!5m2!1spt-BR!2sbr"
                        width="100%"
                        height="450"
                        style={{
                            border: 0,
                            borderRadius: 'var(--radius-sm)'
                        }}
                        allowFullScreen=""
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="G Tec Informática - Localização e Avaliações"
                    />
                </div>
            </div>
        </section>
    );
};

export default GoogleReviews;
