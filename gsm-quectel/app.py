from flask import Flask, render_template
from port_scanner import get_all_port_info

app = Flask(__name__)

@app.route('/')
def index():
    port_data = get_all_port_info()
    return render_template('index.html', ports=port_data)

if __name__ == '__main__':
    app.run(debug=True)
