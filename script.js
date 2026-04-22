// Dark Mode Toggle
(function initDarkMode() {
    const html = document.documentElement;
    const storageKey = 'theme-preference';
    
    // Check saved preference or system preference
    const getSavedTheme = () => localStorage.getItem(storageKey);
    const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    const applyTheme = (theme) => {
        html.style.colorScheme = theme;
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
        localStorage.setItem(storageKey, theme);
    };
    
    // Initialize theme
    const savedTheme = getSavedTheme();
    const initialTheme = savedTheme || getSystemTheme();
    applyTheme(initialTheme);
    
    // Create and add theme toggle button
    const createToggleButton = () => {
        const button = document.createElement('button');
        button.id = 'theme-toggle';
        button.setAttribute('aria-label', 'Toggle dark mode');
        button.innerHTML = '🌙';
        
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: none;
            background: var(--secondary-color);
            color: var(--text-color);
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            z-index: 1000;
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
        });
        
        button.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(currentTheme);
            button.innerHTML = currentTheme === 'dark' ? '☀️' : '🌙';
        });
        
        // Set initial icon based on current theme
        if (initialTheme === 'dark') {
            button.innerHTML = '☀️';
        }
        
        return button;
    };
    
    // Add button when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(createToggleButton());
        });
    } else {
        document.body.appendChild(createToggleButton());
    }
})();
