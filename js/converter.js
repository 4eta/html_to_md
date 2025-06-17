class HtmlToMarkdownConverter {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
  }
  
  initializeElements() {
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.output = document.getElementById('output');
    this.outputSection = document.getElementById('outputSection');
    this.copyBtn = document.getElementById('copyBtn');
    this.status = document.getElementById('status');
    this.loading = document.getElementById('loading');
  }
  
  setupEventListeners() {
    // ドラッグ&ドロップイベント
    this.dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
    this.dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.dropZone.addEventListener('drop', this.handleDrop.bind(this));
    
    // ファイル選択イベント
    this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    
    // コピーボタン
    this.copyBtn.addEventListener('click', this.copyToClipboard.bind(this));
  }
  
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.add('drag-over');
  }
  
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('drag-over');
  }
  
  async handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    const htmlFile = files.find(file => 
      file.type === 'text/html' || 
      file.name.toLowerCase().endsWith('.html') || 
      file.name.toLowerCase().endsWith('.htm')
    );
    
    if (htmlFile) {
      await this.processFile(htmlFile);
    } else {
      this.showStatus('HTMLファイルを選択してください', 'error');
    }
  }
  
  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      await this.processFile(file);
    }
  }
  
  async processFile(file) {
    try {
      this.showLoading(true);
      this.hideStatus();
      
      const html = await file.text();
      const markdown = this.convertHtmlToMarkdown(html);
      
      this.output.textContent = markdown;
      this.outputSection.classList.add('show');
      this.showStatus(`✅ 変換完了: ${file.name}`, 'success');
      
    } catch (error) {
      console.error('変換エラー:', error);
      this.showStatus('変換中にエラーが発生しました', 'error');
    } finally {
      this.showLoading(false);
    }
  }
  
  convertHtmlToMarkdown(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // 不要な要素を除去
      this.removeUnwantedElements(doc);
      
      // 指定された部分を抽出
      const extractedContent = this.extractSpecificSection(doc);
      if (!extractedContent) {
        return '⚠️ 警告: "実行時間制限:" から "Problem Statement" までの部分が見つかりませんでした。\n\nHTMLファイルの構造を確認してください。';
      }
      
      // 変換処理
      return this.processElement(extractedContent).trim();
      
    } catch (error) {
      throw new Error('HTML解析に失敗しました');
    }
  }
  
  extractSpecificSection(doc) {
    // テキストコンテンツから"実行時間制限:"を含む要素を検索
    const allElements = doc.querySelectorAll('*');
    let startElement = null;
    let endElement = null;
    
    // "実行時間制限:"を含む要素を探す
    for (let element of allElements) {
      const textContent = element.textContent;
      if (textContent && textContent.includes('実行時間制限:')) {
        startElement = element;
        break;
      }
    }
    
    if (!startElement) {
      console.log('開始要素 "実行時間制限:" が見つかりません');
      return null;
    }
    
    // "Problem Statement"を含む要素を探す（開始要素より後ろから）
    let foundStart = false;
    for (let element of allElements) {
      if (element === startElement) {
        foundStart = true;
        continue;
      }
      
      if (foundStart) {
        const textContent = element.textContent;
        if (textContent && (
          textContent.includes('Problem Statement') ||
          textContent.includes('問題文') ||
          textContent.includes('問題の説明')
        )) {
          endElement = element;
          break;
        }
      }
    }
    
    if (!endElement) {
      console.log('終了要素 "Problem Statement" が見つかりません');
      return null;
    }
    
    // 開始要素から終了要素までの範囲を抽出
    return this.extractElementsRange(startElement, endElement);
  }
  
  extractElementsRange(startElement, endElement) {
    // 新しいコンテナを作成
    const container = document.createElement('div');
    
    // 開始要素から終了要素まで（終了要素は含まない）の要素を収集
    let currentElement = startElement;
    let collecting = true;
    
    // DOM階層を考慮した要素収集
    const elementsToInclude = [];
    
    // 開始要素を追加
    elementsToInclude.push(startElement.cloneNode(true));
    
    // 開始要素の次の兄弟要素から探索開始
    let nextElement = this.getNextElement(startElement);
    
    while (nextElement && nextElement !== endElement) {
      elementsToInclude.push(nextElement.cloneNode(true));
      nextElement = this.getNextElement(nextElement);
    }
    
    // 収集した要素をコンテナに追加
    elementsToInclude.forEach(element => {
      container.appendChild(element);
    });
    
    return container.children.length > 0 ? container : null;
  }
  
  getNextElement(element) {
    // 次の要素を取得（DOM階層を考慮）
    if (element.nextElementSibling) {
      return element.nextElementSibling;
    }
    
    // 親要素の次の兄弟要素を探す
    let parent = element.parentElement;
    while (parent) {
      if (parent.nextElementSibling) {
        return parent.nextElementSibling;
      }
      parent = parent.parentElement;
    }
    
    return null;
  }
  
  removeUnwantedElements(doc) {
    const unwantedSelectors = ['script', 'style', 'meta', 'link', 'noscript'];
    unwantedSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });
  }
  
  processElement(element) {
    let result = '';
    
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          result += text + ' ';
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        result += this.convertElementToMarkdown(node);
      }
    }
    
    return result;
  }
  
  convertElementToMarkdown(element) {
    const tagName = element.tagName.toLowerCase();
    const text = element.textContent.trim();
    
    if (!text && !['br', 'hr', 'img'].includes(tagName)) {
      return '';
    }
    
    switch (tagName) {
      case 'h1':
        return `\n# ${text}\n\n`;
      case 'h2':
        return `\n## ${text}\n\n`;
      case 'h3':
        return `\n### ${text}\n\n`;
      case 'h4':
        return `\n#### ${text}\n\n`;
      case 'h5':
        return `\n##### ${text}\n\n`;
      case 'h6':
        return `\n###### ${text}\n\n`;
        
      case 'p':
        return `\n${this.processElement(element)}\n\n`;
        
      case 'br':
        return '\n';
        
      case 'hr':
        return '\n---\n\n';
        
      case 'strong':
      case 'b':
        return `**${text}**`;
        
      case 'em':
      case 'i':
        return `*${text}*`;
        
      case 'code':
        return `\`${text}\``;
        
      case 'var':
        return `$${text}$`;
        
      case 'pre':
        const codeElement = element.querySelector('code');
        const codeText = codeElement ? codeElement.textContent : text;
        return `\n\`\`\`\n${codeText}\n\`\`\`\n\n`;
        
      case 'blockquote':
        return `\n> ${this.processElement(element)}\n\n`;
        
      case 'a':
        const href = element.getAttribute('href');
        return href ? `[${text}](${href})` : text;
        
      case 'img':
        const src = element.getAttribute('src');
        const alt = element.getAttribute('alt') || '';
        return src ? `![${alt}](${src})` : '';
        
      case 'ul':
        return '\n' + this.processListItems(element, '- ') + '\n';
        
      case 'ol':
        return '\n' + this.processListItems(element, null, true) + '\n';
        
      case 'li':
        return this.processElement(element);
        
      case 'table':
        return this.processTable(element);
        
      case 'div':
      case 'span':
      case 'section':
      case 'article':
        return this.processElement(element);
        
      default:
        return this.processElement(element);
    }
  }
  
  processListItems(listElement, prefix = '- ', isOrdered = false) {
    const items = Array.from(listElement.children).filter(child => 
      child.tagName.toLowerCase() === 'li'
    );
    
    return items.map((item, index) => {
      const itemPrefix = isOrdered ? `${index + 1}. ` : prefix;
      return `${itemPrefix}${this.processElement(item).trim()}`;
    }).join('\n');
  }
  
  processTable(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return '';
    
    let result = '\n';
    
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('td, th'));
      const cellContents = cells.map(cell => 
        this.processElement(cell).trim().replace(/\n/g, ' ')
      );
      
      result += `| ${cellContents.join(' | ')} |\n`;
      
      // ヘッダー行の後に区切り線を追加
      if (rowIndex === 0 && row.querySelector('th')) {
        result += `| ${cells.map(() => '---').join(' | ')} |\n`;
      }
    });
    
    return result + '\n';
  }
  
  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.output.textContent);
      this.showStatus('📋 クリップボードにコピーしました', 'success');
    } catch (error) {
      this.showStatus('コピーに失敗しました', 'error');
    }
  }
  
  showLoading(show) {
    this.loading.style.display = show ? 'block' : 'none';
  }
  
  showStatus(message, type) {
    this.status.textContent = message;
    this.status.className = `status ${type} show`;
    
    // 3秒後に自動で隠す
    setTimeout(() => {
      this.hideStatus();
    }, 3000);
  }
  
  hideStatus() {
    this.status.classList.remove('show');
  }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
  new HtmlToMarkdownConverter();
});