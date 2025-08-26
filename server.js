const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const multer = require('multer');

const app = express();
const port = 3000;

// Configuração do banco de dados
const db = new sqlite3.Database('market.db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'market-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});
const upload = multer({ storage: storage });

// Inicializar banco de dados
db.serialize(() => {
  // Tabela de usuários
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT DEFAULT 'cliente'
  )`);

  // Tabela de produtos
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL NOT NULL,
    estoque INTEGER DEFAULT 0,
    categoria TEXT,
    imagem TEXT
  )`);

  // Tabela de carrinho
  db.run(`CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    produto_id INTEGER,
    quantidade INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (produto_id) REFERENCES products (id)
  )`);

  // Tabela de pedidos
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    data DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pendente',
    total REAL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Tabela de itens do pedido
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    produto_id INTEGER,
    quantidade INTEGER,
    preco REAL,
    FOREIGN KEY (order_id) REFERENCES orders (id),
    FOREIGN KEY (produto_id) REFERENCES products (id)
  )`);

  // Tabela de promoções
  db.run(`CREATE TABLE IF NOT EXISTS promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER,
    desconto_percentual REAL,
    validade DATE,
    FOREIGN KEY (produto_id) REFERENCES products (id)
  )`);

  // Inserir usuário admin padrão
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
    ['Administrador', 'admin@market.com', adminPassword, 'admin']);

  // Inserir produtos de exemplo
  const produtos = [

  ];

  produtos.forEach(produto => {
    db.run(`INSERT OR IGNORE INTO products (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)`, produto);
  });
});

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Não autorizado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.session.userId && req.session.userType === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado' });
  }
}

// Rotas de autenticação
app.post('/api/register', async (req, res) => {
  const { nome, email, senha } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    
    db.run(`INSERT INTO users (nome, email, senha) VALUES (?, ?, ?)`,
      [nome, email, hashedPassword], function(err) {
        if (err) {
          res.status(400).json({ error: 'Email já existe' });
        } else {
          res.json({ message: 'Usuário criado com sucesso' });
        }
      });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) {
      res.status(400).json({ error: 'Credenciais inválidas' });
      return;
    }
    
    const validPassword = await bcrypt.compare(senha, user.senha);
    if (!validPassword) {
      res.status(400).json({ error: 'Credenciais inválidas' });
      return;
    }
    
    req.session.userId = user.id;
    req.session.userType = user.tipo;
    req.session.userName = user.nome;
    
    res.json({ 
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        nome: user.nome,
        tipo: user.tipo
      }
    });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout realizado com sucesso' });
});

app.get('/api/user', requireAuth, (req, res) => {
  db.get(`SELECT id, nome, email, tipo FROM users WHERE id = ?`, 
    [req.session.userId], (err, user) => {
      if (err || !user) {
        res.status(404).json({ error: 'Usuário não encontrado' });
      } else {
        res.json(user);
      }
    });
});

// Rotas de produtos
app.get('/api/products', (req, res) => {
  const { categoria } = req.query;
  let query = `SELECT p.*, pr.desconto_percentual 
               FROM products p 
               LEFT JOIN promotions pr ON p.id = pr.produto_id 
               AND pr.validade >= date('now')`;
  let params = [];
  
  if (categoria && categoria !== 'todas') {
    query += ' WHERE p.categoria = ?';
    params = [categoria];
  }
  
  db.all(query, params, (err, products) => {
    if (err) {
      res.status(500).json({ error: 'Erro ao buscar produtos' });
    } else {
      res.json(products);
    }
  });
});

app.get('/api/products/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT p.*, pr.desconto_percentual 
          FROM products p 
          LEFT JOIN promotions pr ON p.id = pr.produto_id 
          AND pr.validade >= date('now')
          WHERE p.id = ?`, [id], (err, product) => {
    if (err || !product) {
      res.status(404).json({ error: 'Produto não encontrado' });
    } else {
      res.json(product);
    }
  });
});

app.get('/api/categories', (req, res) => {
  db.all(`SELECT DISTINCT categoria FROM products ORDER BY categoria`, (err, categories) => {
    if (err) {
      res.status(500).json({ error: 'Erro ao buscar categorias' });
    } else {
      res.json(categories);
    }
  });
});

// Rotas do carrinho
app.get('/api/cart', requireAuth, (req, res) => {
  db.all(`SELECT c.*, p.nome, p.preco, p.imagem, p.estoque,
                 CASE WHEN pr.desconto_percentual IS NOT NULL 
                      THEN p.preco * (1 - pr.desconto_percentual / 100)
                      ELSE p.preco 
                 END as preco_final
          FROM cart c
          JOIN products p ON c.produto_id = p.id
          LEFT JOIN promotions pr ON p.id = pr.produto_id 
          AND pr.validade >= date('now')
          WHERE c.user_id = ?`, [req.session.userId], (err, items) => {
    if (err) {
      res.status(500).json({ error: 'Erro ao buscar carrinho' });
    } else {
      res.json(items);
    }
  });
});

app.post('/api/cart', requireAuth, (req, res) => {
  const { produto_id, quantidade } = req.body;
  
  // Verificar se produto já está no carrinho
  db.get(`SELECT * FROM cart WHERE user_id = ? AND produto_id = ?`,
    [req.session.userId, produto_id], (err, existingItem) => {
      if (existingItem) {
        // Atualizar quantidade
        db.run(`UPDATE cart SET quantidade = quantidade + ? WHERE user_id = ? AND produto_id = ?`,
          [quantidade, req.session.userId, produto_id], function(err) {
            if (err) {
              res.status(500).json({ error: 'Erro ao atualizar carrinho' });
            } else {
              res.json({ message: 'Produto adicionado ao carrinho' });
            }
          });
      } else {
        // Adicionar novo item
        db.run(`INSERT INTO cart (user_id, produto_id, quantidade) VALUES (?, ?, ?)`,
          [req.session.userId, produto_id, quantidade], function(err) {
            if (err) {
              res.status(500).json({ error: 'Erro ao adicionar ao carrinho' });
            } else {
              res.json({ message: 'Produto adicionado ao carrinho' });
            }
          });
      }
    });
});

app.put('/api/cart/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { quantidade } = req.body;
  
  db.run(`UPDATE cart SET quantidade = ? WHERE id = ? AND user_id = ?`,
    [quantidade, id, req.session.userId], function(err) {
      if (err) {
        res.status(500).json({ error: 'Erro ao atualizar carrinho' });
      } else {
        res.json({ message: 'Carrinho atualizado' });
      }
    });
});

app.delete('/api/cart/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM cart WHERE id = ? AND user_id = ?`,
    [id, req.session.userId], function(err) {
      if (err) {
        res.status(500).json({ error: 'Erro ao remover item' });
      } else {
        res.json({ message: 'Item removido do carrinho' });
      }
    });
});

// Rotas de pedidos
app.post('/api/orders', requireAuth, (req, res) => {
  const userId = req.session.userId;
  
  // Buscar itens do carrinho
  db.all(`SELECT c.*, p.preco,
                 CASE WHEN pr.desconto_percentual IS NOT NULL 
                      THEN p.preco * (1 - pr.desconto_percentual / 100)
                      ELSE p.preco 
                 END as preco_final
          FROM cart c
          JOIN products p ON c.produto_id = p.id
          LEFT JOIN promotions pr ON p.id = pr.produto_id 
          AND pr.validade >= date('now')
          WHERE c.user_id = ?`, [userId], (err, cartItems) => {
    if (err || cartItems.length === 0) {
      res.status(400).json({ error: 'Carrinho vazio' });
      return;
    }
    
    const total = cartItems.reduce((sum, item) => sum + (item.preco_final * item.quantidade), 0);
    
    // Criar pedido
    db.run(`INSERT INTO orders (user_id, total) VALUES (?, ?)`,
      [userId, total], function(err) {
        if (err) {
          res.status(500).json({ error: 'Erro ao criar pedido' });
          return;
        }
        
        const orderId = this.lastID;
        
        // Adicionar itens do pedido
        const stmt = db.prepare(`INSERT INTO order_items (order_id, produto_id, quantidade, preco) VALUES (?, ?, ?, ?)`);
        
        cartItems.forEach(item => {
          stmt.run([orderId, item.produto_id, item.quantidade, item.preco_final]);
        });
        
        stmt.finalize();
        
        // Limpar carrinho
        db.run(`DELETE FROM cart WHERE user_id = ?`, [userId]);
        
        res.json({ message: 'Pedido realizado com sucesso', orderId });
      });
  });
});

app.get('/api/orders', requireAuth, (req, res) => {
  db.all(`SELECT * FROM orders WHERE user_id = ? ORDER BY data DESC`,
    [req.session.userId], (err, orders) => {
      if (err) {
        res.status(500).json({ error: 'Erro ao buscar pedidos' });
      } else {
        res.json(orders);
      }
    });
});

app.get('/api/orders/:id/items', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.all(`SELECT oi.*, p.nome, p.imagem
          FROM order_items oi
          JOIN products p ON oi.produto_id = p.id
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.order_id = ? AND o.user_id = ?`,
    [id, req.session.userId], (err, items) => {
      if (err) {
        res.status(500).json({ error: 'Erro ao buscar itens do pedido' });
      } else {
        res.json(items);
      }
    });
});

// Rotas administrativas
app.get('/api/admin/products', requireAdmin, (req, res) => {
  db.all(`SELECT p.*, pr.desconto_percentual, pr.validade
          FROM products p
          LEFT JOIN promotions pr ON p.id = pr.produto_id 
          AND pr.validade >= date('now')
          ORDER BY p.id DESC`, (err, products) => {
    if (err) {
      res.status(500).json({ error: 'Erro ao buscar produtos' });
    } else {
      res.json(products);
    }
  });
});

app.post('/api/admin/products', requireAdmin, upload.single('imagem'), (req, res) => {
  const { nome, descricao, preco, estoque, categoria } = req.body;
  const imagem = req.file ? req.file.filename : null;
  
  db.run(`INSERT INTO products (nome, descricao, preco, estoque, categoria, imagem) VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, descricao, preco, estoque, categoria, imagem], function(err) {
      if (err) {
        res.status(500).json({ error: 'Erro ao criar produto' });
      } else {
        res.json({ message: 'Produto criado com sucesso', id: this.lastID });
      }
    });
});

app.put('/api/admin/products/:id', requireAdmin, upload.single('imagem'), (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco, estoque, categoria } = req.body;
  const imagem = req.file ? req.file.filename : null;
  
  let query = `UPDATE products SET nome = ?, descricao = ?, preco = ?, estoque = ?, categoria = ?`;
  let params = [nome, descricao, preco, estoque, categoria];
  
  if (imagem) {
    query += `, imagem = ?`;
    params.push(imagem);
  }
  
  query += ` WHERE id = ?`;
  params.push(id);
  
  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ error: 'Erro ao atualizar produto' });
    } else {
      res.json({ message: 'Produto atualizado com sucesso' });
    }
  });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM products WHERE id = ?`, [id], function(err) {
    if (err) {
      res.status(500).json({ error: 'Erro ao excluir produto' });
    } else {
      res.json({ message: 'Produto excluído com sucesso' });
    }
  });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  db.all(`SELECT o.*, u.nome as cliente_nome, u.email as cliente_email
          FROM orders o
          JOIN users u ON o.user_id = u.id
          ORDER BY o.data DESC`, (err, orders) => {
    if (err) {
      res.status(500).json({ error: 'Erro ao buscar pedidos' });
    } else {
      res.json(orders);
    }
  });
});

app.get('/api/admin/orders/:id/items', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.all(`SELECT oi.*, p.nome, p.imagem
          FROM order_items oi
          JOIN products p ON oi.produto_id = p.id
          WHERE oi.order_id = ?`, [id], (err, items) => {
    if (err) {
      res.status(500).json({ error: 'Erro ao buscar itens do pedido' });
    } else {
      res.json(items);
    }
  });
});

app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id], function(err) {
    if (err) {
      res.status(500).json({ error: 'Erro ao atualizar status' });
    } else {
      res.json({ message: 'Status atualizado com sucesso' });
    }
  });
});

// Rotas de promoções
app.post('/api/admin/promotions', requireAdmin, (req, res) => {
  const { produto_id, desconto_percentual, validade } = req.body;
  
  db.run(`INSERT OR REPLACE INTO promotions (produto_id, desconto_percentual, validade) VALUES (?, ?, ?)`,
    [produto_id, desconto_percentual, validade], function(err) {
      if (err) {
        res.status(500).json({ error: 'Erro ao criar promoção' });
      } else {
        res.json({ message: 'Promoção criada com sucesso' });
      }
    });
});

// Servir páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/product/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});

app.get('/orders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/promotions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'promotions.html'));
});

app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'support.html'));
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});