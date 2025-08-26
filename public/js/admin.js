// Admin authentication
async function checkAdminAuth() {
    try {
        const response = await fetch('/api/user');
        
        if (response.ok) {
            const user = await response.json();
            if (user.tipo !== 'admin') {
                showToast('Acesso negado', 'danger');
                window.location.href = '/';
                return;
            }
            
            document.getElementById('admin-name').textContent = user.nome;
            
            // Setup logout
            document.getElementById('logout-btn').addEventListener('click', async function() {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/';
            });
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        window.location.href = '/login';
    }
}

// Load admin data
function loadAdminData() {
    loadAdminProducts();
    loadAdminOrders();
    loadProductsForPromotion();
}

// Navigation setup
function setupAdminNavigation() {
    const navLinks = document.querySelectorAll('[data-section]');
    const sections = document.querySelectorAll('.section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetSection = this.getAttribute('data-section');
            
            // Update active nav
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Update active section
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(targetSection + '-section').classList.add('active');
            
            // Load section data if needed
            if (targetSection === 'orders') {
                loadAdminOrders();
            } else if (targetSection === 'products') {
                loadAdminProducts();
            } else if (targetSection === 'promotions') {
                loadProductsForPromotion();
            }
        });
    });
}

// Products management
async function loadAdminProducts() {
    try {
        const response = await fetch('/api/admin/products');
        const products = await response.json();
        
        if (response.ok) {
            displayAdminProducts(products);
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

function displayAdminProducts(products) {
    const productsList = document.getElementById('products-list');
    
    if (products.length === 0) {
        productsList.innerHTML = `
            <div class="alert alert-info text-center">
                <h5>Nenhum produto cadastrado</h5>
                <p>Clique no botão "Novo Produto" para começar</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Imagem</th>
                        <th>Nome</th>
                        <th>Categoria</th>
                        <th>Preço</th>
                        <th>Estoque</th>
                        <th>Promoção</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    products.forEach(product => {
        const hasPromotion = product.desconto_percentual && product.desconto_percentual > 0;
        
        html += `
            <tr>
                <td>
                    <img src="/images/${product.imagem || 'no-image.jpg'}" 
                         alt="${product.nome}" 
                         class="rounded" 
                         style="width: 50px; height: 50px; object-fit: cover;">
                </td>
                <td>
                    <strong>${product.nome}</strong>
                    <br>
                    <small class="text-muted">${product.descricao ? product.descricao.substring(0, 50) + '...' : 'Sem descrição'}</small>
                </td>
                <td><span class="badge bg-secondary">${product.categoria}</span></td>
                <td>
                    ${hasPromotion ? `
                        <span class="text-muted text-decoration-line-through">R$ ${product.preco.toFixed(2)}</span>
                        <br>
                        <strong class="text-success">R$ ${(product.preco * (1 - product.desconto_percentual / 100)).toFixed(2)}</strong>
                    ` : `
                        <strong>R$ ${product.preco.toFixed(2)}</strong>
                    `}
                </td>
                <td>
                    <span class="badge ${product.estoque > 0 ? 'bg-success' : 'bg-danger'}">
                        ${product.estoque} un.
                    </span>
                </td>
                <td>
                    ${hasPromotion ? `
                        <span class="badge bg-warning">
                            ${product.desconto_percentual}% OFF
                        </span>
                    ` : `
                        <span class="text-muted">-</span>
                    `}
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editProduct(${product.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteProduct(${product.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    productsList.innerHTML = html;
    
    // Setup product form
    setupProductForm();
}

function setupProductForm() {
    const productForm = document.getElementById('productForm');
    if (!productForm) return;
    
    productForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData();
        const productId = document.getElementById('productId').value;
        
        formData.append('nome', document.getElementById('productName').value);
        formData.append('descricao', document.getElementById('productDescription').value);
        formData.append('preco', document.getElementById('productPrice').value);
        formData.append('estoque', document.getElementById('productStock').value);
        formData.append('categoria', document.getElementById('productCategory').value);
        
        const imageFile = document.getElementById('productImage').files[0];
        if (imageFile) {
            formData.append('imagem', imageFile);
        }
        
        try {
            const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
            const method = productId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showToast(productId ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
                modal.hide();
                
                // Reload products
                loadAdminProducts();
                
                // Reset form
                productForm.reset();
                document.getElementById('productId').value = '';
                document.getElementById('productModalTitle').textContent = 'Novo Produto';
            } else {
                showToast(data.error, 'danger');
            }
        } catch (error) {
            showToast('Erro ao salvar produto', 'danger');
        }
    });
}

async function editProduct(productId) {
    try {
        const response = await fetch(`/api/products/${productId}`);
        const product = await response.json();
        
        if (response.ok) {
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.nome;
            document.getElementById('productDescription').value = product.descricao || '';
            document.getElementById('productPrice').value = product.preco;
            document.getElementById('productStock').value = product.estoque;
            document.getElementById('productCategory').value = product.categoria;
            document.getElementById('productModalTitle').textContent = 'Editar Produto';
            
            const modal = new bootstrap.Modal(document.getElementById('productModal'));
            modal.show();
        }
    } catch (error) {
        showToast('Erro ao carregar produto', 'danger');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/products/${productId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Produto excluído com sucesso!', 'success');
            loadAdminProducts();
        } else {
            showToast(data.error, 'danger');
        }
    } catch (error) {
        showToast('Erro ao excluir produto', 'danger');
    }
}

// Orders management
async function loadAdminOrders() {
    try {
        const response = await fetch('/api/admin/orders');
        const orders = await response.json();
        
        if (response.ok) {
            displayAdminOrders(orders);
        }
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
    }
}

function displayAdminOrders(orders) {
    const ordersList = document.getElementById('orders-list');
    
    if (orders.length === 0) {
        ordersList.innerHTML = `
            <div class="alert alert-info text-center">
                <h5>Nenhum pedido encontrado</h5>
                <p>Os pedidos dos clientes aparecerão aqui</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Data</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    orders.forEach(order => {
        const statusColor = getOrderStatusColor(order.status);
        const statusIcon = getOrderStatusIcon(order.status);
        
        html += `
            <tr>
                <td><strong>#${order.id}</strong></td>
                <td>
                    <strong>${order.cliente_nome}</strong>
                    <br>
                    <small class="text-muted">${order.cliente_email}</small>
                </td>
                <td>${formatOrderDate(order.data)}</td>
                <td><strong>R$ ${order.total.toFixed(2)}</strong></td>
                <td>
                    <select class="form-select form-select-sm" 
                            onchange="updateOrderStatus(${order.id}, this.value)">
                        <option value="pendente" ${order.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="processando" ${order.status === 'processando' ? 'selected' : ''}>Processando</option>
                        <option value="enviado" ${order.status === 'enviado' ? 'selected' : ''}>Enviado</option>
                        <option value="entregue" ${order.status === 'entregue' ? 'selected' : ''}>Entregue</option>
                        <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-outline-primary btn-sm" 
                            onclick="viewOrderDetails(${order.id})">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    ordersList.innerHTML = html;
}

function getOrderStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'pendente': return 'warning';
        case 'processando': return 'info';
        case 'enviado': return 'primary';
        case 'entregue': return 'success';
        case 'cancelado': return 'danger';
        default: return 'secondary';
    }
}

function getOrderStatusIcon(status) {
    switch (status.toLowerCase()) {
        case 'pendente': return 'fas fa-clock';
        case 'processando': return 'fas fa-cog';
        case 'enviado': return 'fas fa-truck';
        case 'entregue': return 'fas fa-check';
        case 'cancelado': return 'fas fa-times';
        default: return 'fas fa-info';
    }
}

function formatOrderDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Status atualizado com sucesso!', 'success');
        } else {
            showToast(data.error, 'danger');
            loadAdminOrders(); // Reload to revert changes
        }
    } catch (error) {
        showToast('Erro ao atualizar status', 'danger');
        loadAdminOrders(); // Reload to revert changes
    }
}

async function viewOrderDetails(orderId) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}/items`);
        const items = await response.json();
        
        if (response.ok) {
            displayOrderDetailsModal(orderId, items);
        }
    } catch (error) {
        showToast('Erro ao carregar detalhes do pedido', 'danger');
    }
}

function displayOrderDetailsModal(orderId, items) {
    let html = `
        <h6>Pedido #${orderId}</h6>
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Quantidade</th>
                        <th>Preço Unit.</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    let grandTotal = 0;
    
    items.forEach(item => {
        const itemTotal = item.preco * item.quantidade;
        grandTotal += itemTotal;
        
        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="/images/${item.imagem || 'no-image.jpg'}" 
                             alt="${item.nome}" 
                             class="me-2" 
                             style="width: 40px; height: 40px; object-fit: cover;">
                        ${item.nome}
                    </div>
                </td>
                <td>${item.quantidade}</td>
                <td>R$ ${item.preco.toFixed(2)}</td>
                <td>R$ ${itemTotal.toFixed(2)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
                <tfoot>
                    <tr class="table-active">
                        <th colspan="3">Total do Pedido:</th>
                        <th>R$ ${grandTotal.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    document.getElementById('orderDetailsContent').innerHTML = html;
    
    const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
    modal.show();
}

// Promotions management
async function loadProductsForPromotion() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        
        if (response.ok) {
            populatePromotionProductSelect(products);
            displayProductsForPromotion(products);
        }
    } catch (error) {
        console.error('Erro ao carregar produtos para promoção:', error);
    }
}

function populatePromotionProductSelect(products) {
    const select = document.getElementById('promotionProduct');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um produto...</option>';
    
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.nome} - R$ ${product.preco.toFixed(2)}`;
        select.appendChild(option);
    });
    
    // Setup promotion form
    setupPromotionForm();
}

function displayProductsForPromotion(products) {
    const container = document.getElementById('products-for-promotion');
    if (!container) return;
    
    let html = `
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Preço Original</th>
                        <th>Promoção Ativa</th>
                        <th>Preço Final</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    products.forEach(product => {
        const hasPromotion = product.desconto_percentual && product.desconto_percentual > 0;
        const finalPrice = hasPromotion 
            ? product.preco * (1 - product.desconto_percentual / 100)
            : product.preco;
            
        html += `
            <tr>
                <td>${product.nome}</td>
                <td>R$ ${product.preco.toFixed(2)}</td>
                <td>
                    ${hasPromotion ? `
                        <span class="badge bg-success">${product.desconto_percentual}% OFF</span>
                    ` : `
                        <span class="text-muted">Nenhuma</span>
                    `}
                </td>
                <td>
                    <strong ${hasPromotion ? 'class="text-success"' : ''}>
                        R$ ${finalPrice.toFixed(2)}
                    </strong>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

function setupPromotionForm() {
    const promotionForm = document.getElementById('promotionForm');
    if (!promotionForm) return;
    
    // Remove existing listener
    promotionForm.removeEventListener('submit', handlePromotionSubmit);
    promotionForm.addEventListener('submit', handlePromotionSubmit);
}

async function handlePromotionSubmit(e) {
    e.preventDefault();
    
    const formData = {
        produto_id: document.getElementById('promotionProduct').value,
        desconto_percentual: document.getElementById('promotionDiscount').value,
        validade: document.getElementById('promotionValidity').value
    };
    
    try {
        const response = await fetch('/api/admin/promotions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Promoção criada com sucesso!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('promotionModal'));
            modal.hide();
            
            // Reset form
            e.target.reset();
            
            // Reload products
            loadProductsForPromotion();
            loadAdminProducts();
        } else {
            showToast(data.error, 'danger');
        }
    } catch (error) {
        showToast('Erro ao criar promoção', 'danger');
    }
}