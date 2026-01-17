import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, QrCode, Truck, CheckCircle, MapPin, User, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const Checkout = () => {
    const { cart, cartTotal, registerSale, clearCart } = useData();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '', email: '', doc: '', phone: '',
        cep: '', street: '', number: '', city: '', state: '',
        cardName: '', cardNumber: '', cardExp: '', cardCvv: ''
    });

    const [paymentMethod, setPaymentMethod] = useState('credit_card');

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCepBlur = async () => {
        const cep = formData.cep.replace(/\D/g, '');
        if (cep.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();

                if (data.erro) {
                    toast.error("CEP não encontrado.");
                    return;
                }

                setFormData(prev => ({
                    ...prev,
                    street: data.logradouro,
                    city: data.localidade,
                    state: data.uf,
                    // Clear number/complement if needed or keep existing
                }));
                toast.success("Endereço encontrado!");
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
                toast.error("Erro ao buscar o CEP.");
            }
        }
    };

    const handlePlaceOrder = async () => {
        setLoading(true);

        // Simulate processing
        setTimeout(() => {
            const order = {
                items: cart,
                total: cartTotal,
                userEmail: formData.email,
                customerName: formData.name,
                address: `${formData.street}, ${formData.number} - ${formData.city}/${formData.state}`,
                paymentMethod: paymentMethod === 'pix' ? 'PIX' : 'Cartão de Crédito',
                status: 'Pendente',
                date: new Date().toISOString()
            };

            registerSale(order); // Save to context/localstorage
            clearCart();
            setLoading(false);
            setStep(3); // Success Step
        }, 2000);
    };

    if (cart.length === 0 && step !== 3) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'white' }}>
                <h2>Seu carrinho está vazio.</h2>
                <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1rem' }}>Voltar para a Loja</button>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'white' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                    <ArrowLeft />
                </button>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Finalizar Compra</h1>
            </div>

            {/* Steps Indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: step >= 1 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: step >= 1 ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)', color: step >= 1 ? 'black' : 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>1</div>
                    <span>Identificação & Entrega</span>
                </div>
                <div style={{ width: '50px', height: '2px', background: 'rgba(255,255,255,0.1)', margin: '0 1rem' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: step >= 2 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: step >= 2 ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)', color: step >= 2 ? 'black' : 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>2</div>
                    <span>Pagamento</span>
                </div>
                <div style={{ width: '50px', height: '2px', background: 'rgba(255,255,255,0.1)', margin: '0 1rem' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: step >= 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: step >= 3 ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)', color: step >= 3 ? 'black' : 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>3</div>
                    <span>Confirmação</span>
                </div>
            </div>

            {step === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    {/* Identification */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><User size={20} color="var(--color-accent)" /> Seus Dados</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input type="text" name="name" placeholder="Nome Completo" value={formData.name} onChange={handleInputChange} style={inputStyle} />
                            <input type="email" name="email" placeholder="E-mail" value={formData.email} onChange={handleInputChange} style={inputStyle} />
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <input type="text" name="doc" placeholder="CPF/CNPJ" value={formData.doc} onChange={handleInputChange} style={inputStyle} />
                                <input type="text" name="phone" placeholder="Celular" value={formData.phone} onChange={handleInputChange} style={inputStyle} />
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><MapPin size={20} color="var(--color-accent)" /> Endereço de Entrega</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <input type="text" name="cep" placeholder="CEP" maxLength={8} value={formData.cep} onChange={handleInputChange} onBlur={handleCepBlur} style={inputStyle} />
                                <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" style={{ fontSize: '0.8rem', color: 'var(--color-accent)', textDecoration: 'underline', alignSelf: 'center' }}>Não sei meu CEP</a>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <input type="text" name="street" placeholder="Rua / Avenida" value={formData.street} onChange={handleInputChange} style={{ ...inputStyle, flex: 2 }} />
                                <input type="text" name="number" placeholder="Número" value={formData.number} onChange={handleInputChange} style={{ ...inputStyle, flex: 1 }} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <input type="text" name="city" placeholder="Cidade" value={formData.city} onChange={handleInputChange} style={inputStyle} />
                                <input type="text" name="state" placeholder="Estado" value={formData.state} onChange={handleInputChange} style={{ ...inputStyle, width: '80px' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => {
                                if (!formData.name || !formData.email || !formData.doc || !formData.street || !formData.number || !formData.city) {
                                    toast.error("Por favor, preencha todos os campos obrigatórios.");
                                    return;
                                }
                                setStep(2);
                            }}
                            className="btn-primary"
                        >
                            Ir para Pagamento
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                    <div className="card">
                        <h3 style={{ marginBottom: '1.5rem' }}>Método de Pagamento</h3>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                            <button
                                onClick={() => setPaymentMethod('credit_card')}
                                style={{
                                    flex: 1, padding: '1rem', borderRadius: '8px',
                                    background: paymentMethod === 'credit_card' ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                                    border: 'none', color: paymentMethod === 'credit_card' ? 'black' : 'white', fontWeight: 'bold', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                <CreditCard size={20} /> Cartão de Crédito
                            </button>
                            <button
                                onClick={() => setPaymentMethod('pix')}
                                style={{
                                    flex: 1, padding: '1rem', borderRadius: '8px',
                                    background: paymentMethod === 'pix' ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                                    border: 'none', color: paymentMethod === 'pix' ? 'black' : 'white', fontWeight: 'bold', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                <QrCode size={20} /> PIX (5% OFF)
                            </button>
                        </div>

                        {paymentMethod === 'credit_card' ? (
                            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                {/* Virtual Card Visual */}
                                <div style={{
                                    width: '320px', height: '200px', borderRadius: '16px',
                                    background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ width: '40px', height: '30px', background: '#ccc', borderRadius: '4px' }}></div>
                                        <span style={{ fontStyle: 'italic', fontWeight: 'bold' }}>CREDIT</span>
                                    </div>
                                    <div style={{ fontSize: '1.4rem', letterSpacing: '2px', fontFamily: 'monospace' }}>
                                        {formData.cardNumber || '0000 0000 0000 0000'}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: '#aaa' }}>Nome</div>
                                            <div>{formData.cardName || 'NOME DO TITULAR'}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: '#aaa' }}>Validade</div>
                                            <div>{formData.cardExp || 'MM/AA'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Form */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <input type="text" name="cardNumber" placeholder="Número do Cartão" maxLength={19} value={formData.cardNumber} onChange={handleInputChange} style={inputStyle} />
                                    <input type="text" name="cardName" placeholder="Nome Impresso no Cartão" value={formData.cardName} onChange={handleInputChange} style={inputStyle} />
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <input type="text" name="cardExp" placeholder="MM/AA" maxLength={5} value={formData.cardExp} onChange={handleInputChange} style={inputStyle} />
                                        <input type="text" name="cardCvv" placeholder="CVV" maxLength={3} value={formData.cardCvv} onChange={handleInputChange} style={inputStyle} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2rem', background: 'white', borderRadius: '8px' }}>
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GTEC-PIX-PAYMENT-MOCK`} alt="QR Code Pix" />
                                <p style={{ color: 'black', fontWeight: 'bold', marginTop: '1rem' }}>Escaneie para pagar</p>
                                <p style={{ color: '#666', fontSize: '0.9rem' }}>Aprovação imediata</p>
                            </div>
                        )}
                    </div>

                    {/* Order Summary */}
                    <div className="card" style={{ height: 'fit-content' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Resumo do Pedido</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                            {cart.map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>{item.qty}x {item.name}</span>
                                    <span>R$ {(item.price * item.qty).toLocaleString('pt-BR')}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                                <span>R$ {cartTotal.toLocaleString('pt-BR')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Frete</span>
                                <span style={{ color: 'var(--color-success)' }}>Grátis</span>
                            </div>
                            {paymentMethod === 'pix' && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: 'var(--color-success)' }}>
                                    <span>Desconto Pix (5%)</span>
                                    <span>- R$ {(cartTotal * 0.05).toLocaleString('pt-BR')}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginTop: '1rem', color: 'var(--color-accent)' }}>
                                <span>Total</span>
                                <span>R$ {(paymentMethod === 'pix' ? cartTotal * 0.95 : cartTotal).toLocaleString('pt-BR')}</span>
                            </div>
                        </div>
                        <button
                            onClick={handlePlaceOrder}
                            disabled={loading || (paymentMethod === 'credit_card' && !formData.cardNumber)}
                            className="btn-primary"
                            style={{ width: '100%', marginTop: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
                        >
                            {loading ? 'Processando...' : (
                                <>
                                    <ShieldCheck size={20} /> Finalizar Pedido
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--color-bg-card)', borderRadius: '16px', maxWidth: '600px', margin: '0 auto', border: '1px solid var(--color-success)' }}>
                    <div style={{ width: '80px', height: '80px', background: 'var(--color-success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto' }}>
                        <CheckCircle size={40} color="white" />
                    </div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'white' }}>Pedido Confirmado!</h2>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>Obrigado pela preferência, <strong>{formData.name}</strong>. Enviaremos as atualizações para <strong>{formData.email}</strong>.</p>

                    <button onClick={() => navigate('/')} className="btn-primary">Voltar para a Loja</button>
                    <button onClick={() => navigate('/admin/orders')} className="btn-outline" style={{ marginLeft: '10px' }}>Ver Meus Pedidos</button>
                </div>
            )}
        </div>
    );
};

const inputStyle = {
    padding: '12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'white',
    outline: 'none',
    width: '100%'
};

export default Checkout;
