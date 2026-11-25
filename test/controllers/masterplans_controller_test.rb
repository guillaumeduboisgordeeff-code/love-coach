require "test_helper"

class MasterplansControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get masterplans_index_url
    assert_response :success
  end

  test "should get show" do
    get masterplans_show_url
    assert_response :success
  end
end
