import json
import pytest
from app import app  # import app Flask của bạn ở đây

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

def test_get_simcards(client):
    """Test GET /api/simcards - lấy danh sách all sim"""
    response = client.get('/api/simcards')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)

def test_post_simcard(client):
    """Test POST /api/simcards - tạo sim mới"""
    new_sim = {
        "pc_name": "PC-TEST",
        "port": "COM99",
        "phone_number": "+123456789",
        "ccid": "12345CCID",
        "sim_provider": "TestProvider",
        "content": "Test content",
        "sales_target": 150,
        "status": "active"
    }
    response = client.post('/api/simcards', json=new_sim)
    assert response.status_code == 201
    data = response.get_json()
    assert data.get('pc_name') == "PC-TEST"
    assert data.get('port') == "COM99"

def _test_get_simcard_detail(client):
    """Test GET /api/simcards/<id> - lấy chi tiết sim"""
    # Giả sử có sim id=1
    response = client.get('/api/simcards/1')
    if response.status_code == 404:
        pytest.skip("Sim with id=1 not found - skip detail test")
    assert response.status_code == 200
    data = response.get_json()
    assert 'pc_name' in data

def _test_batch_create(client):
    """Test POST batch tạo nhiều sim"""
    batch_data = [
        {
            "pc_name": "PC-BATCH1",
            "port": "COM100",
            "phone_number": "+111111111",
            "ccid": "ccid1",
            "sim_provider": "Provider1",
            "content": "Content1"
        },
        {
            "pc_name": "PC-BATCH2",
            "port": "COM101",
            "phone_number": "+222222222",
            "ccid": "ccid2",
            "sim_provider": "Provider2",
            "content": "Content2"
        }
    ]
    response = client.post('/api/simcards/batch_create', json=batch_data)
    assert response.status_code == 201
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 2

def _test_increase_sales(client):
    """Test POST /api/simcards/<id>/increase_sales - tăng sales"""
    # Giả sử có sim id=1
    payload = {"amount": 5, "threshold":10}
    response = client.post('/api/simcards/1/increase_sales', json=payload)
    if response.status_code == 404:
        pytest.skip("Sim with id=1 not found - skip increase_sales test")
    assert response.status_code == 200
    data = response.get_json()
    assert "near_target_sims" in data

def _test_search_sim(client):
    """Test GET /api/simcards/search?pc_name=...&port=..."""
    pc_name = "PC-TEST"
    port = "COM99"
    response = client.get(f'/api/simcards/search?pc_name={pc_name}&port={port}')
    if response.status_code == 404:
        pytest.skip("Sim not found for search params")
    assert response.status_code == 200
    data = response.get_json()
    assert data.get('pc_name') == pc_name
    assert data.get('port') == port

def _test_near_target_list(client):
    """Test GET /api/simcards/nearby?threshold=50"""
    response = client.get('/api/simcards/nearby?threshold=50')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)

