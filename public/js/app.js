// Global variables
let currentUser = null;

// Toast notification function
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toastId = 'toast-' + Date.now();
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                    data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}

// Authentication functions
async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            updateAuthUI(user);
        } else {
            currentUser = null;
            updateAuthUI(null);
        }
    } catch (error) {
        currentUser = null;
        updateAuthUI(null);
    }
}

function updateAuthUI(user) {
    const authNav = document.getElementById('auth-nav');
    const userNav = document.getElementById('user-nav');
    const adminNav = document.getElementById('admin-nav');
    const userName = document.getElementById('user-name');
    
    if (user) {
        authNav.style.display = 'none';
        userNav.style.display = 'block';
        userName.textContent = user.nome;
        
        if (user.tipo === 'admin' && adminNav) {
            adminNav.style.display = 'block';
        }
    } else {
        authNav.style.display = 'block';
        userNav.style.display = 'none';
        if (adminNav) {
            adminNav.style.display = 'none';
        }
    }
    
    // Setup logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showToast('Logout realizado com sucesso', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    } catch (error) {
        showToast('Erro ao fazer logout', 'danger');
    }
}

// Cart functions
async function updateCartCount() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/cart');
        
        if (response.ok) {
            const cartItems = await response.json();
            const totalItems = cartItems.reduce((sum, item) => sum + item.quantidade, 0);
            
            const cartCountElement = document.getElementById('cart-count');
            if (cartCountElement) {
                cartCountElement.textContent = totalItems;
                cartCountElement.style.display = totalItems > 0 ? 'inline' : 'none';
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar contador do carrinho:', error);
    }
}

// Product functions
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter && response.ok) {
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.categoria;
                option.textContent = cat.categoria;
                categoryFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

async function loadProducts() {
    const categoryFilter = document.getElementById('category-filter');
    const categoria = categoryFilter ? categoryFilter.value : 'todas';
    
    try {
        let url = '/api/products';
        if (categoria && categoria !== 'todas') {
            url += `?categoria=${encodeURIComponent(categoria)}`;
        }
        
        const response = await fetch(url);
        const products = await response.json();
        
        if (response.ok) {
            displayProducts(products);
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

function displayProducts(products) {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;
    
    if (products.length === 0) {
        productsGrid.innerHTML = `
            <div class="col-12 text-center">
                <h5>Nenhum produto encontrado</h5>
                <p>Tente filtrar por uma categoria diferente</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    products.forEach(product => {
        const finalPrice = product.desconto_percentual 
            ? product.preco * (1 - product.desconto_percentual / 100)
            : product.preco;
            
        const hasDiscount = product.desconto_percentual && product.desconto_percentual > 0;
        const isOutOfStock = product.estoque === 0;
        
        html += `
            <div class="col-sm-6 col-md-4 col-lg-3 mb-4">
                <div class="card product-card h-100">
                    ${hasDiscount ? `
                        <span class="badge bg-danger position-absolute" style="top: 10px; right: 10px; z-index: 2;">
                            ${product.desconto_percentual}% OFF
                        </span>
                    ` : ''}
                    ${isOutOfStock ? `
                        <span class="badge bg-secondary position-absolute" style="top: 10px; left: 10px; z-index: 2;">
                            Sem Estoque
                        </span>
                    ` : ''}
                    
                    <img src="/images/${product.imagem || 'no-image.jpg'}" 
                         class="card-img-top" 
                         alt="${product.nome}">
                    
                    <div class="card-body d-flex flex-column">
                        <h6 class="card-title">${product.nome}</h6>
                        <p class="card-text text-muted small">${product.categoria}</p>
                        
                        <div class="price-section mt-auto">
                            ${hasDiscount ? `
                                <small class="text-muted text-decoration-line-through d-block">
                                    R$ ${product.preco.toFixed(2)}
                                </small>
                            ` : ''}
                            <div class="price text-success fw-bold">
                                R$ ${finalPrice.toFixed(2)}
                            </div>
                        </div>
                        
                        <div class="mt-3">
                            <a href="/product/${product.id}" class="btn btn-outline-primary btn-sm me-2">
                                Ver Detalhes
                            </a>
                            <button class="btn btn-primary btn-sm" 
                                    onclick="addToCartFromList(${product.id})"
                                    ${isOutOfStock ? 'disabled' : ''}>
                                <i class="fas fa-cart-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    productsGrid.innerHTML = html;
}

async function addToCartFromList(productId) {
    if (!currentUser) {
        showToast('Você precisa fazer login primeiro', 'warning');
        setTimeout(() => window.location.href = '/login', 1500);
        return;
    }
    
    try {
        const response = await fetch('/api/cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                produto_id: productId,
                quantidade: 1
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Produto adicionado ao carrinho!', 'success');
            updateCartCount();
        } else {
            showToast(data.error, 'danger');
        }
    } catch (error) {
        showToast('Erro ao adicionar ao carrinho', 'danger');
    }
}

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Initialize tooltips and popovers
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize Bootstrap popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
});